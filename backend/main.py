import os
import json
import jwt
import asyncio
import bcrypt
from datetime import datetime, timezone, timedelta
from typing import List
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from dotenv import load_dotenv
from google.antigravity import Agent, LocalAgentConfig, CapabilitiesConfig
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

# Import database helpers and models
from database import get_db, engine, Base, QuizResult, WorkspaceCache, User

# Import video generation function from agent_engine
from agent_engine import process_educational_video

# Slowapi rate limiting imports
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

# Load environment variables from .env file
load_dotenv()

# 🔒 SECURITY SYSTEM CONFIGURATIONS
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("Configuration error: SECRET_KEY environment variable is not set. Please set it in your environment or .env file.")

ALGORITHM = os.getenv("ALGORITHM", "HS256")
TOKEN_EXPIRATION_HOURS = int(os.getenv("TOKEN_EXPIRATION_HOURS", "24"))
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

# Configurable Rate Limits
LIMIT_WORKSPACE = os.getenv("LIMIT_WORKSPACE", "10/minute")
LIMIT_QUIZ = os.getenv("LIMIT_QUIZ", "15/minute")
LIMIT_ASK = os.getenv("LIMIT_ASK", "20/minute")
LIMIT_LOGIN = os.getenv("LIMIT_LOGIN", "5/minute")
LIMIT_REGISTER = os.getenv("LIMIT_REGISTER", "3/minute")

# Slowapi Rate Limiter Setup
limiter = Limiter(key_func=get_remote_address)

security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        pwd_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(pwd_bytes, hashed_bytes)
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(pwd_bytes, salt)
    return hashed.decode('utf-8')

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: AsyncSession = Depends(get_db)) -> User:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid token: missing subject."
            )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=401,
            detail="Token has expired. Please log in again."
        )
    except jwt.InvalidTokenError as e:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid token: {str(e)}"
        )
        
    stmt = select(User).filter(User.username == username.strip().lower())
    result = await db.execute(stmt)
    user = result.scalars().first()
    if user is None:
        raise HTTPException(
            status_code=401,
            detail="User not found."
        )
    return user

@asynccontextmanager
async def lifespan(app: FastAPI):
    if not GEMINI_API_KEY:
        print("[WARNING] GEMINI_API_KEY is not set in the environment or .env file. AI-driven workspace and quiz generation will fail!")
    # Establish SQLite schema on startup automatically
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(title="VisualLearn AI Backend Engine", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS configuration
# To configure CORS for production (e.g. on Render or Railway), set the ALLOWED_ORIGINS environment variable
# on the platform's environment settings dashboard.
# Example: ALLOWED_ORIGINS=https://visuallearn-ai.onrender.com,http://localhost:4200
ALLOWED_ORIGINS_ENV = os.getenv("ALLOWED_ORIGINS")
DEBUG_MODE = os.getenv("DEBUG", "false").lower() == "true"

if DEBUG_MODE:
    print("[WARNING] CORS is running in DEBUG mode. Allowing all origins.")
    origins = ["*"]
else:
    if ALLOWED_ORIGINS_ENV:
        origins = [o.strip() for o in ALLOWED_ORIGINS_ENV.split(",") if o.strip()]
    else:
        origins = ["http://localhost:4200"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(BASE_DIR, "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Strict Schema instructions for the Google Antigravity Agent
SYSTEM_INSTRUCTIONS = (
    "You are the Director Engine for VisualLearn AI. You take an educational topic and "
    "output exactly a valid JSON object. Do not include markdown codeblocks or extra conversational text. "
    "The output JSON must strictly follow this structural format:\n"
    "{\n"
    '  "topic": "Topic Name",\n'
    '  "subject": "e.g., Physics, Astronomy, Biology",\n'
    '  "grade": "Class 10",\n'
    '  "keyPoints": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5"],\n'
    '  "quizQuestion": "A conceptual multiple choice question?",\n'
    '  "quizOptions": ["Option A", "Option B", "Option C", "Option D"],\n'
    '  "correctAnswerIndex": 1,\n'
    '  "videoLoopTag": "space",\n'
    '  "videoSummary": "A concise paragraph summarizing the educational video content and core lesson takeaway.",\n'
    '  "recommendedLessons": [\n'
    '    {\n'
    '      "topic": "Related Topic 1",\n'
    '      "subject": "Subject Name",\n'
    '      "grade": "Class 10",\n'
    '      "duration": "8 min"\n'
    '    },\n'
    '    {\n'
    '      "topic": "Related Topic 2",\n'
    '      "subject": "Subject Name",\n'
    '      "grade": "Class 10",\n'
    '      "duration": "12 min"\n'
    '    }\n'
    '  ]\n'
    "}"
)

class GenerationRequest(BaseModel):
    prompt: str

# Local database mapping tags to generic background video clips
VIDEO_LOOP_MAP = {
    "space": "static/video_loops/space_bg.mp4",
    "biology": "static/video_loops/biology_bg.mp4",
    "physics": "static/video_loops/physics_bg.mp4",
    "default": "static/video_loops/default_bg.mp4"
}

def get_video_url(tag: str, base_dir: str) -> str:
    rel_path = VIDEO_LOOP_MAP.get(tag.lower(), VIDEO_LOOP_MAP["default"])
    abs_path = os.path.join(base_dir, rel_path)
    if os.path.exists(abs_path):
        return f"http://localhost:8000/{rel_path}"
    else:
        return f"http://localhost:8000/{VIDEO_LOOP_MAP['default']}"

async def calculate_gamification(username: str, db: AsyncSession) -> dict:
    stmt = select(QuizResult.correct_count).filter(QuizResult.username == username)
    res = await db.execute(stmt)
    correct_counts = res.scalars().all()
    total_xp = sum(correct_counts) * 50
    
    stmt_dates = select(QuizResult.timestamp).filter(QuizResult.username == username).order_by(QuizResult.timestamp.desc())
    res_dates = await db.execute(stmt_dates)
    timestamps = res_dates.scalars().all()
    
    if not timestamps:
        return {"levelXP": 0, "streakDays": 0}
        
    unique_dates = sorted(list({t.date() for t in timestamps}), reverse=True)
    
    today = datetime.now(timezone.utc).date()
    yesterday = today - timedelta(days=1)
    
    if unique_dates[0] != today and unique_dates[0] != yesterday:
        return {"levelXP": total_xp, "streakDays": 0}
        
    streak = 1
    current_date = unique_dates[0]
    
    for next_date in unique_dates[1:]:
        if current_date - next_date == timedelta(days=1):
            streak += 1
            current_date = next_date
        elif current_date - next_date > timedelta(days=1):
            break
            
    return {"levelXP": total_xp, "streakDays": streak}

@app.post("/api/generate-workspace")
@limiter.limit(LIMIT_WORKSPACE)
async def generate_workspace(request: Request, payload: GenerationRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if not payload.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt query cannot be empty.")
    
    clean_prompt = payload.prompt.strip().lower()
    
    # 🔍 Try to serve from SQLite WorkspaceCache first
    try:
        cached_result = await db.execute(
            select(WorkspaceCache).filter(WorkspaceCache.prompt == clean_prompt)
        )
        cached = cached_result.scalars().first()
        if cached:
            print(f"[CACHE HIT] Loaded workspace from SQLite database cache for prompt: '{clean_prompt}'")
            quiz_dict = json.loads(cached.quiz_data)
            game_stats = await calculate_gamification(current_user.username, db)
            return {
                "topic": cached.topic,
                "subject": cached.subject,
                "grade": cached.grade,
                "videoUrl": cached.video_url,
                "keyPoints": json.loads(cached.key_points),
                "quizQuestion": quiz_dict.get("quizQuestion"),
                "quizOptions": quiz_dict.get("quizOptions", []),
                "correctAnswerIndex": quiz_dict.get("correctAnswerIndex", -1),
                "relatedTopics": quiz_dict.get("relatedTopics", ["Overview", "Fundamentals", "Applications"]),
                "videoSummary": quiz_dict.get("videoSummary", ""),
                "recommendedLessons": quiz_dict.get("recommendedLessons", []),
                "streakDays": game_stats["streakDays"],
                "levelXP": game_stats["levelXP"]
            }
    except Exception as cache_err:
        print(f"[WARNING] Cache lookup failed: {str(cache_err)}")

    config = LocalAgentConfig(
        system_instructions=SYSTEM_INSTRUCTIONS,
        capabilities=CapabilitiesConfig(enabled_tools=[]),
        api_key=GEMINI_API_KEY
    )
    output_payload = None

    try:
        async def call_ai():
            async with Agent(config) as orchestrator:
                ai_prompt = f"Create a comprehensive educational workspace profile block for the topic: '{payload.prompt}'."
                response = await orchestrator.chat(ai_prompt)
                return await response.text()

        raw_text = await asyncio.wait_for(call_ai(), timeout=12.0)
        clean_json = raw_text.replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_json)
            
        tag = data.get("videoLoopTag", "default").lower()
        video_url = get_video_url(tag, BASE_DIR)
        
        output_payload = {
            "topic": data.get("topic", payload.prompt.title()),
            "subject": data.get("subject", "General Science"),
            "grade": data.get("grade", "Class 10"),
            "videoUrl": video_url,
            "keyPoints": data.get("keyPoints", []),
            "quizQuestion": data.get("quizQuestion"),
            "quizOptions": data.get("quizOptions", []),
            "correctAnswerIndex": data.get("correctAnswerIndex", -1),
            "relatedTopics": data.get("relatedTopics", ["Overview", "Fundamentals", "Applications"]),
            "videoSummary": data.get("videoSummary", f"This video workspace covers the foundational mechanics, processes, and applications of {payload.prompt.title()}."),
            "recommendedLessons": data.get("recommendedLessons", [
                {"topic": f"Introduction to {payload.prompt.title()}", "subject": "Science", "grade": "Class 10", "duration": "5 min"},
                {"topic": f"Advanced {payload.prompt.title()}", "subject": "Science", "grade": "Class 10", "duration": "9 min"}
            ])
        }

    except Exception as e:
        # ✨ FALLBACK LOGIC: Triggers automatically if 429, 503, or timeouts strike
        print(f"[WARNING] API Quota Exhausted or Engine Failure ({str(e)}). Deploying smart local fallback workspace...")
        
        topic_title = payload.prompt.title()
        clean_topic = topic_title.lower()

        if "solar" in clean_topic or "space" in clean_topic or "universe" in clean_topic or "galaxy" in clean_topic or "astronomy" in clean_topic:
            youtube_id = "zkCKx3fpk4Q"
            subject = "Astronomy & Cosmology"
            key_points = [
                "Space is extremely vast, containing billions of galaxies, stars, and planetary systems.",
                "Stars generate light and energy through nuclear fusion in their core regions.",
                "Planets orbit stars due to gravitational attraction following elliptical trajectories.",
                "Nebula clouds of gas and dust serve as the stellar nurseries where new stars are born.",
                "Modern space telescopes like Hubble and JWST allow us to observe distant cosmic structures."
            ]
            quiz_question = "What force keeps planets in orbit around their host stars?"
            quiz_options = ["Gravity", "Magnetism", "Centrifugal Force", "Friction"]
            correct_index = 0
            video_summary = f"This video introduces the cosmic scales of space, stars, and planetary motion, detailing how gravity shapes our universe in relation to {topic_title}."
            lessons = [
                {"topic": "Stellar Lifecycle", "subject": "Cosmology", "grade": "Level 02", "duration": "12 min"},
                {"topic": "Black Holes & Gravity", "subject": "Cosmology", "grade": "Level 02", "duration": "18 min"}
            ]
            video_url = f"https://www.youtube.com/embed/{youtube_id}?autoplay=1&mute=1&loop=1&playlist={youtube_id}&controls=0&modestbranding=1&rel=0"

        elif "photosynthesis" in clean_topic or "chlorophyll" in clean_topic or "plant" in clean_topic or "leaf" in clean_topic:
            youtube_id = "D1Ymc311XS8"
            subject = "Plant Biology"
            key_points = [
                "Photosynthesis is the process by which green plants convert solar energy into chemical energy.",
                "Chlorophyll pigments in chloroplasts absorb blue and red light while reflecting green light.",
                "The light-dependent reactions split water molecules, releasing oxygen as a byproduct.",
                "The light-independent reactions (Calvin Cycle) use carbon dioxide to synthesize glucose.",
                "This chemical process forms the energy foundation for almost all food chains on Earth."
            ]
            quiz_question = "Which cellular organelle is the primary site where photosynthesis occurs?"
            quiz_options = ["Mitochondrion", "Chloroplast", "Nucleus", "Ribosome"]
            correct_index = 1
            video_summary = f"This animated lesson teaches the fundamentals of photosynthesis, detailing how plants use sunlight, water, and carbon dioxide to produce glucose and oxygen."
            lessons = [
                {"topic": "Plant Cell Structure", "subject": "Biology", "grade": "Level 02", "duration": "10 min"},
                {"topic": "The Calvin Cycle", "subject": "Biology", "grade": "Level 02", "duration": "15 min"}
            ]
            video_url = f"https://www.youtube.com/embed/{youtube_id}?autoplay=1&mute=1&loop=1&playlist={youtube_id}&controls=0&modestbranding=1&rel=0"

        elif "immune" in clean_topic or "biology" in clean_topic or "cell" in clean_topic or "body" in clean_topic or "respiration" in clean_topic:
            youtube_id = "lXfEK8G8CUI"
            subject = "Life Sciences"
            key_points = [
                "The immune system protects the body from harmful pathogens like bacteria and viruses.",
                "White blood cells (leukocytes) identify, target, and destroy foreign invaders.",
                "Antibodies are specialized proteins that bind to antigens to neutralize threat agents.",
                "The lymphatic system helps transport immune cells and filter pathogens from fluids.",
                "Vaccines train the immune system by introducing harmless pathogen markers."
            ]
            quiz_question = "What specialized proteins are produced by B-cells to bind and neutralize specific antigens?"
            quiz_options = ["Hormones", "Enzymes", "Antibodies", "Lipids"]
            correct_index = 2
            video_summary = f"This educational video explores how the immune system defends the human body, showcasing the complex interactions between white blood cells, pathogens, and antibodies."
            lessons = [
                {"topic": "Types of White Blood Cells", "subject": "Biology", "grade": "Level 02", "duration": "14 min"},
                {"topic": "Pathogens and Disease", "subject": "Biology", "grade": "Level 02", "duration": "11 min"}
            ]
            video_url = f"https://www.youtube.com/embed/{youtube_id}?autoplay=1&mute=1&loop=1&playlist={youtube_id}&controls=0&modestbranding=1&rel=0"

        elif "quantum" in clean_topic or "physics" in clean_topic or "atom" in clean_topic or "gravity" in clean_topic or "particle" in clean_topic:
            youtube_id = "p9pPjASnnxw"
            subject = "Theoretical Physics"
            key_points = [
                "Quantum mechanics is the study of matter and energy at the scale of atoms and subatomic particles.",
                "Wave-particle duality suggests that particles can behave like waves and vice versa.",
                "Superposition allows a quantum system to exist in multiple states simultaneously until measured.",
                "Quantum entanglement links particles such that the state of one instantly affects the other.",
                "The uncertainty principle states we cannot simultaneously know a particle's exact position and momentum."
            ]
            quiz_question = "What quantum principle states that a particle can exist in multiple states at the same time until observed?"
            quiz_options = ["Superposition", "Entanglement", "Quantization", "Decoherence"]
            correct_index = 0
            video_summary = f"This video presents the basics of quantum mechanics, introducing wave-particle duality, superposition, and subatomic behaviors."
            lessons = [
                {"topic": "The Double Slit Experiment", "subject": "Physics", "grade": "Level 02", "duration": "16 min"},
                {"topic": "Quantum Computers", "subject": "Physics", "grade": "Level 02", "duration": "12 min"}
            ]
            video_url = f"https://www.youtube.com/embed/{youtube_id}?autoplay=1&mute=1&loop=1&playlist={youtube_id}&controls=0&modestbranding=1&rel=0"

        elif "antigravity" in clean_topic or "propulsion" in clean_topic or "rocket" in clean_topic or "spacecraft" in clean_topic:
            youtube_id = "bC9t2tH6rP0"
            subject = "Aerospace Engineering"
            key_points = [
                "Propulsion systems generate thrust to move spacecraft through the vacuum of space.",
                "Chemical rockets rely on rapid combustion of fuel and oxidizer to produce exhaust gas.",
                "Ion engines use electromagnetic fields to accelerate charged particles for highly efficient thrust.",
                "Thrust and impulse determine the rate of acceleration and total velocity change of a spacecraft.",
                "Advanced concepts explore theoretical fields like gravity manipulation and warp drives."
            ]
            quiz_question = "Which type of engine accelerates charged gas particles using electric fields to produce high-efficiency thrust?"
            quiz_options = ["Chemical Rocket", "Ion Thruster", "Turbojet Engine", "Steam Turbine"]
            correct_index = 1
            video_summary = f"This video investigates space propulsion systems, highlighting how NASA engineers design thrusters and ion engines to propel deep space exploration missions."
            lessons = [
                {"topic": "Orbital Mechanics", "subject": "Aerospace", "grade": "Level 02", "duration": "15 min"},
                {"topic": "Ion Propulsion Tests", "subject": "Aerospace", "grade": "Level 02", "duration": "10 min"}
            ]
            video_url = f"https://www.youtube.com/embed/{youtube_id}?autoplay=1&mute=1&loop=1&playlist={youtube_id}&controls=0&modestbranding=1&rel=0"

        else:
            subject = "General Science"
            key_points = [
                f"Science is a systematic approach to understanding the natural world through observation of {topic_title}.",
                "The scientific method begins with forming a testable hypothesis based on structural parameters.",
                "Controlled experiments vary a single independent variable to test its systemic effects.",
                "Data analysis and peer review help establish baseline scientific engineering theories.",
                "Scientific models are continually updated as new empirical evidence is discovered."
            ]
            quiz_question = "What is the first step in the traditional scientific method after making observations?"
            quiz_options = ["Formulating a Hypothesis", "Drawing a Conclusion", "Analyzing Data", "Publishing Results"]
            correct_index = 0
            video_summary = f"This overview workspace introduces the scientific method, highlighting the roles of observation, hypothesis testing, and systematic inquiry in relation to {topic_title}."
            lessons = [
                {"topic": f"Designing {topic_title} Experiments", "subject": "Science", "grade": "Level 02", "duration": "10 min"},
                {"topic": f"Advanced {topic_title} Reasoning", "subject": "Science", "grade": "Level 02", "duration": "12 min"}
            ]
            url_search_query = topic_title.replace(" ", "+") + "+educational+lesson"
            video_url = f"https://www.youtube.com/embed?listType=search&list={url_search_query}&autoplay=1&mute=1&controls=1&modestbranding=1&rel=0"

        output_payload = {
            "topic": topic_title,
            "subject": subject,
            "grade": "Class 10",
            "videoUrl": video_url,
            "keyPoints": key_points,
            "quizQuestion": quiz_question,
            "quizOptions": quiz_options,
            "correctAnswerIndex": correct_index,
            "relatedTopics": [f"{topic_title} Basics", "Advanced Analysis", "Case Studies"],
            "videoSummary": video_summary,
            "recommendedLessons": lessons
        }

    # 💾 Cache the newly generated/fallback workspace in SQLite database
    if output_payload:
        try:
            new_cache = WorkspaceCache(
                prompt=clean_prompt,
                topic=output_payload["topic"],
                subject=output_payload["subject"],
                grade=output_payload["grade"],
                video_url=output_payload["videoUrl"],
                key_points=json.dumps(output_payload["keyPoints"]),
                quiz_data=json.dumps({
                    "quizQuestion": output_payload["quizQuestion"],
                    "quizOptions": output_payload["quizOptions"],
                    "correctAnswerIndex": output_payload["correctAnswerIndex"],
                    "relatedTopics": output_payload["relatedTopics"],
                    "videoSummary": output_payload["videoSummary"],
                    "recommendedLessons": output_payload["recommendedLessons"]
                })
            )
            db.add(new_cache)
            await db.commit()
            print(f"[CACHE STORE] Cached workspace in SQLite database for prompt: '{clean_prompt}'")
        except Exception as cache_store_err:
            await db.rollback()
            print(f"[WARNING] Failed to cache generated workspace: {str(cache_store_err)}")

    game_stats = await calculate_gamification(current_user.username, db)
    return {
        **output_payload,
        "streakDays": game_stats["streakDays"],
        "levelXP": game_stats["levelXP"]
    }

# FALLBACK_QUIZ_BANK containing 10 educational questions per topic
FALLBACK_QUIZ_BANK = {
    "photosynthesis": [
        {"question": "What is the primary function of chlorophyll in photosynthesis?", "options": ["Absorb light energy", "Produce carbon dioxide", "Store glucose", "Release water"], "correctIndex": 0},
        {"question": "Where do the light-dependent reactions of photosynthesis occur?", "options": ["Stroma", "Thylakoid membrane", "Mitochondria", "Cytoplasm"], "correctIndex": 1},
        {"question": "Which of the following is a product of the light reactions?", "options": ["Glucose", "Carbon dioxide", "Oxygen", "Water"], "correctIndex": 2},
        {"question": "What happens in the stroma during the Calvin cycle?", "options": ["Carbon fixation and glucose production", "Splitting of water molecules", "Release of oxygen gas", "ATP synthesis"], "correctIndex": 0},
        {"question": "What are the starting materials for photosynthesis?", "options": ["Glucose and Oxygen", "Carbon Dioxide, Water, and Light", "Nitrogen and Carbon Dioxide", "Oxygen and Water"], "correctIndex": 1},
        {"question": "Which molecule splits to release oxygen gas during photosynthesis?", "options": ["Water", "Carbon dioxide", "Glucose", "ATP"], "correctIndex": 0},
        {"question": "What is the main energy-carrying molecule produced in light reactions?", "options": ["Calvin", "ATP and NADPH", "Stroma", "Glucose"], "correctIndex": 1},
        {"question": "Which pigment absorbs blue and red light best?", "options": ["Chlorophyll a", "Carotene", "Xanthophyll", "Anthocyanin"], "correctIndex": 0},
        {"question": "Which factor does NOT directly affect the rate of photosynthesis?", "options": ["Light intensity", "Temperature", "Carbon dioxide level", "Nitrogen level"], "correctIndex": 3},
        {"question": "In what form is sugar transported in plants?", "options": ["Sucrose", "Glucose", "Starch", "Glycogen"], "correctIndex": 0}
    ],
    "quantum mechanics": [
        {"question": "What principle states that you cannot simultaneously know a particle's exact position and momentum?", "options": ["Schrodinger equation", "Heisenberg Uncertainty Principle", "Planck relation", "Einstein relativity"], "correctIndex": 1},
        {"question": "What is a single packet of light energy called?", "options": ["Electron", "Photon", "Proton", "Neutron"], "correctIndex": 1},
        {"question": "Which phenomenon refers to particles behaving like waves and vice versa?", "options": ["Wave-particle duality", "Quantum superposition", "Quantum entanglement", "Planck constant"], "correctIndex": 0},
        {"question": "What is the basic unit of quantum information called?", "options": ["Bit", "Qubit", "Byte", "Quantum dot"], "correctIndex": 1},
        {"question": "What state exists when a quantum system is in multiple states at once?", "options": ["Superposition", "Entanglement", "Coherence", "Superconductivity"], "correctIndex": 0},
        {"question": "Which term describes particles having coupled states regardless of distance?", "options": ["Superposition", "Entanglement", "Tunneling", "Decoherence"], "correctIndex": 1},
        {"question": "Who introduced the quantum theory with his constant 'h'?", "options": ["Max Planck", "Albert Einstein", "Niels Bohr", "Erwin Schrodinger"], "correctIndex": 0},
        {"question": "What describes the probability amplitude of a quantum state?", "options": ["Wave function", "Momentum vector", "Spin state", "Tunneling barrier"], "correctIndex": 0},
        {"question": "What occurs when a quantum wave function is measured?", "options": ["Wave function collapse", "Entanglement", "Superposition", "Superconductivity"], "correctIndex": 0},
        {"question": "Which phenomenon allows particles to pass through potential barriers?", "options": ["Quantum tunneling", "Quantum entanglement", "Superposition", "Planck emission"], "correctIndex": 0}
    ],
    "space": [
        {"question": "Which is the largest planet in our solar system?", "options": ["Saturn", "Jupiter", "Neptune", "Uranus"], "correctIndex": 1},
        {"question": "What type of celestial object is the Sun?", "options": ["Planet", "Star", "Comet", "Nebula"], "correctIndex": 1},
        {"question": "Which planet is known as the Red Planet?", "options": ["Venus", "Mars", "Mercury", "Jupiter"], "correctIndex": 1},
        {"question": "What is the name of our galaxy?", "options": ["Andromeda", "Milky Way", "Triangulum", "Sombrero"], "correctIndex": 1},
        {"question": "Which planet is closest to the Sun?", "options": ["Earth", "Mercury", "Venus", "Mars"], "correctIndex": 1},
        {"question": "What force keeps planets in orbit around the Sun?", "options": ["Electromagnetic force", "Gravity", "Friction", "Centrifugal force"], "correctIndex": 1},
        {"question": "Which planet is famous for its prominent rings?", "options": ["Saturn", "Jupiter", "Uranus", "Neptune"], "correctIndex": 0},
        {"question": "What is the hottest planet in our solar system?", "options": ["Mercury", "Venus", "Mars", "Jupiter"], "correctIndex": 1},
        {"question": "How long does it take for Earth to orbit the Sun once?", "options": ["24 hours", "30 days", "365 days", "10 years"], "correctIndex": 2},
        {"question": "What is the natural satellite of Earth?", "options": ["The Moon", "Sputnik", "Titan", "Ganymede"], "correctIndex": 0}
    ],
    "immune system": [
        {"question": "Which blood cells are the primary defenders of the immune system?", "options": ["Red blood cells", "White blood cells", "Platelets", "Plasma"], "correctIndex": 1},
        {"question": "What are proteins produced by B-cells that bind to antigens?", "options": ["Antibodies", "Pathogens", "Hormones", "Enzymes"], "correctIndex": 0},
        {"question": "Which organ is responsible for filtering pathogens from the blood?", "options": ["Liver", "Spleen", "Kidney", "Lungs"], "correctIndex": 1},
        {"question": "What type of immunity is acquired by vaccination?", "options": ["Active artificial immunity", "Passive natural immunity", "Innate immunity", "Inherent immunity"], "correctIndex": 0},
        {"question": "Which cells destroy virally infected cells and tumor cells?", "options": ["Red blood cells", "Helper T-cells", "Killer T-cells / NK cells", "Plasma cells"], "correctIndex": 2},
        {"question": "What is a harmless version of a pathogen used to stimulate immunity?", "options": ["Antigen", "Antibiotic", "Vaccine", "Toxin"], "correctIndex": 2},
        {"question": "Which barrier serves as the first line of defense against pathogens?", "options": ["White blood cells", "The Skin", "Lymph nodes", "Antibodies"], "correctIndex": 1},
        {"question": "What is the body's local response to tissue injury or infection?", "options": ["Fever", "Inflammation", "Lysis", "Superposition"], "correctIndex": 1},
        {"question": "Which cells produce antibodies?", "options": ["T-cells", "B-cells", "Macrophages", "Red blood cells"], "correctIndex": 1},
        {"question": "What term describes the immune system attacking the body's own tissues?", "options": ["Allergy", "Autoimmune disease", "Innate response", "Immunity collapse"], "correctIndex": 1}
    ],
    "cellular respiration": [
        {"question": "Where in the cell does Glycolysis occur?", "options": ["Mitochondria", "Cytoplasm", "Nucleus", "Ribosome"], "correctIndex": 1},
        {"question": "What is the primary starting sugar molecule for cellular respiration?", "options": ["Sucrose", "Glucose", "Starch", "Fructose"], "correctIndex": 1},
        {"question": "Which stage of cellular respiration produces the most ATP?", "options": ["Glycolysis", "Krebs Cycle", "Electron Transport Chain", "Fermentation"], "correctIndex": 2},
        {"question": "What gas is required for aerobic respiration to proceed?", "options": ["Carbon dioxide", "Oxygen", "Nitrogen", "Hydrogen"], "correctIndex": 1},
        {"question": "What are the main products of cellular respiration?", "options": ["Glucose and Oxygen", "Carbon Dioxide, Water, and ATP", "Nitrogen and Carbon Dioxide", "Lactic Acid and Glucose"], "correctIndex": 1},
        {"question": "Which mitochondrial structure holds the Electron Transport Chain?", "options": ["Outer membrane", "Inner membrane / Cristae", "Matrix", "Intermembrane space"], "correctIndex": 1},
        {"question": "What product is formed in muscles during anaerobic respiration?", "options": ["Lactic acid", "Ethanol", "Glucose", "Pyruvate"], "correctIndex": 0},
        {"question": "Which coenzyme acts as an electron carrier in respiration?", "options": ["ATP", "NADH", "Chlorophyll", "DNA"], "correctIndex": 1},
        {"question": "What cycle processes pyruvate to produce carbon dioxide and electron carriers?", "options": ["Calvin cycle", "Krebs cycle", "Urea cycle", "Glycolysis"], "correctIndex": 1},
        {"question": "What is the net ATP yield from one molecule of glucose in glycolysis?", "options": ["2 ATP", "4 ATP", "36 ATP", "38 ATP"], "correctIndex": 0}
    ]
}

GENERAL_SCIENCE_FALLBACK = [
    {"question": "What is the chemical symbol for water?", "options": ["O2", "CO2", "H2O", "HO2"], "correctIndex": 2},
    {"question": "Which force pulls objects toward the center of the Earth?", "options": ["Magnetism", "Gravity", "Friction", "Buoyancy"], "correctIndex": 1},
    {"question": "What is the closest star to Earth?", "options": ["Sirius", "Proxima Centauri", "The Sun", "Betelgeuse"], "correctIndex": 2},
    {"question": "Which gas do humans inhale to survive?", "options": ["Carbon Dioxide", "Nitrogen", "Oxygen", "Argon"], "correctIndex": 2},
    {"question": "What is the primary source of energy for Earth's organisms?", "options": ["The Moon", "The Sun", "Geothermal heat", "Wind"], "correctIndex": 1},
    {"question": "How many states of matter are commonly observed?", "options": ["One", "Two", "Three", "Four"], "correctIndex": 2},
    {"question": "What organ acts as the pump of the human circulatory system?", "options": ["Lungs", "Brain", "Heart", "Liver"], "correctIndex": 2},
    {"question": "Which instrument is used to measure temperature?", "options": ["Barometer", "Thermometer", "Hygrometer", "Anemometer"], "correctIndex": 1},
    {"question": "What is the freezing point of water in Celsius?", "options": ["-10°C", "0°C", "32°C", "100°C"], "correctIndex": 1},
    {"question": "Which planet is famous for being the third from the Sun?", "options": ["Venus", "Mars", "Earth", "Mercury"], "correctIndex": 2}
]

def get_generic_quiz(topic: str) -> list:
    topic_lower = topic.lower()
    for key, questions in FALLBACK_QUIZ_BANK.items():
        if key in topic_lower or (key == "space" and "solar" in topic_lower):
            return questions
    return GENERAL_SCIENCE_FALLBACK

class QuizRequest(BaseModel):
    topic: str

@app.post("/api/generate-quiz")
@limiter.limit(LIMIT_QUIZ)
async def generate_quiz(request: Request, payload: QuizRequest, current_user: User = Depends(get_current_user)):
    topic = payload.topic.strip()
    if not topic:
        raise HTTPException(status_code=400, detail="Topic field cannot be empty.")
        
    try:
        print(f"Attempting live AI quiz generation for: {topic}")
        quiz_instructions = (
            "You are an expert educational AI generator for VisualLearn AI. "
            "Take the educational topic provided by the user and generate exactly a valid JSON object. "
            "Do not include any markdown formatting, markdown code blocks (e.g. do NOT output ```json ... ```), "
            "or extra conversational text. The response must contain exactly 10 multiple-choice questions. "
            "The output JSON must strictly follow this exact structural format:\n"
            "{\n"
            '  "topic": "Topic Title String",\n'
            '  "questions": [\n'
            '    {\n'
            '      "question": "Clear concept question statement?",\n'
            '      "options": ["Option A", "Option B", "Option C", "Option D"],\n'
            '      "correctIndex": 0\n'
            '    }\n'
            '  ]\n'
            "}"
        )
        
        # The google-antigravity library uses "gemini-2.5-flash" by default (or similar library default)
        config = LocalAgentConfig(
            system_instructions=quiz_instructions,
            capabilities=CapabilitiesConfig(enabled_tools=[]),
            api_key=GEMINI_API_KEY
        )
        
        async def call_ai():
            async with Agent(config) as orchestrator:
                prompt = f"Generate exactly 10 multiple-choice questions for the topic: '{topic}'."
                response = await orchestrator.chat(prompt)
                return await response.text()

        raw_text = await asyncio.wait_for(call_ai(), timeout=12.0)
        clean_json = raw_text.replace("```json", "").replace("```", "").strip()
        data = json.loads(clean_json)
        return data

    except Exception as e:
        print(f"[WARNING] Quiz Engine Throttled ({str(e)}). Deploying robust 10-question fallback deck...")
        fallback_questions = get_generic_quiz(topic)
        return {
            "topic": topic.title(),
            "questions": fallback_questions
        }

# Ask Anything Q&A Request schema
class AskQuestionRequest(BaseModel):
    topic: str
    videoUrl: str
    videoSummary: str
    question: str

@app.post("/api/ask-question")
@limiter.limit(LIMIT_ASK)
async def ask_question(request: Request, payload: AskQuestionRequest, current_user: User = Depends(get_current_user)):
    import base64
    try:
        # Decrypt (Base64 decode) parameters
        topic = base64.b64decode(payload.topic).decode('utf-8')
        video_url = base64.b64decode(payload.videoUrl).decode('utf-8')
        video_summary = base64.b64decode(payload.videoSummary).decode('utf-8')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to decrypt parameters: {str(e)}")
        
    print(f"[QA] Decrypted Ask Anything request: topic='{topic}', question='{payload.question}'")
 
    # If the question is simply asking to summarize the video, return the summary directly within seconds
    clean_question = payload.question.lower().strip()
    if "summarize" in clean_question or "summary" in clean_question:
        return {"answer": f"Here is the AI video summary for '{topic}':\n\n{video_summary}"}
 
    try:
        # Try live agent Q&A first
        config = LocalAgentConfig(
            system_instructions=(
                "You are an expert AI teaching assistant for VisualLearn AI. "
                "Answer the student's question accurately and concisely using the provided context."
            ),
            capabilities=CapabilitiesConfig(enabled_tools=[]),
            api_key=GEMINI_API_KEY
        )
        async def call_ai():
            async with Agent(config) as orchestrator:
                prompt = (
                    f"Active Topic: {topic}\n"
                    f"Video Resource: {video_url}\n"
                    f"Video Summary Context: {video_summary}\n"
                    f"Student Question: {payload.question}\n\n"
                    f"Provide a helpful, educational response based on the summary."
                )
                response = await orchestrator.chat(prompt)
                return await response.text()
 
        answer = await asyncio.wait_for(call_ai(), timeout=12.0)
        return {"answer": answer}
            
    except Exception as e:
        # Local Q&A Fallback
        print(f"[WARNING] Live QA Agent failed ({str(e)}). Executing smart local fallback Q&A...")
        
        # Simple local text extraction fallback based on summary content
        sentences = [s.strip() for s in video_summary.split('.') if s.strip()]
        words = [w.lower() for w in payload.question.split() if len(w) > 3]
        
        relevant_sentences = []
        for sentence in sentences:
            if any(word in sentence.lower() for word in words):
                relevant_sentences.append(sentence)
                
        if relevant_sentences:
            answer = (
                f"Based on the video summary context:\n"
                f"• " + "\n• ".join(relevant_sentences) + f"\n\n"
                f"This relates directly to your query about '{topic}'."
            )
        else:
            answer = f"I couldn't find specific context for your question about '{topic}'. Try rephrasing it."
        return {"answer": answer}

# --- DB Persistence API endpoints ---

class QuizScoreRequest(BaseModel):
    username: str
    topic: str
    score: int
    correct_count: int

@app.post("/api/save-quiz-score")
async def save_quiz_score(request: QuizScoreRequest, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if request.username.strip().lower() != current_user.username.strip().lower():
        raise HTTPException(
            status_code=403,
            detail="Forbidden: You are not authorized to save scores for another user."
        )
    try:
        new_result = QuizResult(
            username=request.username,
            topic=request.topic,
            score=request.score,
            correct_count=request.correct_count
        )
        db.add(new_result)
        await db.commit()
        return {"status": "success", "message": "Quiz score saved successfully."}
    except Exception as e:
        await db.rollback()
        print(f"[ERROR] Failed to save quiz score: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database persistence error: {str(e)}")

@app.get("/api/user-stats")
async def get_user_stats(username: str, db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    if username.strip().lower() != current_user.username.strip().lower():
        raise HTTPException(
            status_code=403,
            detail="Forbidden: You are not authorized to view statistics for another user."
        )
    try:
        # Query quiz results for the user, ordered by timestamp desc
        stmt = select(QuizResult).filter(QuizResult.username == username).order_by(QuizResult.timestamp.desc())
        results = await db.execute(stmt)
        quiz_list = results.scalars().all()
        
        total_quizzes = len(quiz_list)
        if total_quizzes > 0:
            avg_score = sum(q.score for q in quiz_list) / total_quizzes
            # Calculate accumulated XP dynamically (e.g. 50 XP per correct answer)
            total_xp = sum(q.correct_count for q in quiz_list) * 50
        else:
            avg_score = 0.0
            total_xp = 0
            
        recent_quizzes = [
            {
                "title": q.topic,
                "score": q.score,
                "date": q.timestamp.strftime("%b %d, %Y")
            }
            for q in quiz_list[:5]
        ]
        
        return {
            "total_quizzes": total_quizzes,
            "average_score": round(avg_score, 1),
            "total_xp": total_xp,
            "recent_quizzes": recent_quizzes
        }
    except Exception as e:
        print(f"[ERROR] Failed to aggregate user stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database aggregation error: {str(e)}")

@app.get("/api/user-stats/detailed")
async def get_user_stats_detailed(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        stmt = select(QuizResult).filter(QuizResult.username == current_user.username)
        results = await db.execute(stmt)
        quiz_list = results.scalars().all()

        total_quizzes = len(quiz_list)
        if total_quizzes > 0:
            avg_score = sum(q.score for q in quiz_list) / total_quizzes
            total_xp = sum(q.correct_count for q in quiz_list) * 50
        else:
            avg_score = 0.0
            total_xp = 0

        unique_topics = set(q.topic for q in quiz_list)
        topics_explored = len(unique_topics)

        breakdown = {}
        for q in quiz_list:
            breakdown[q.topic] = breakdown.get(q.topic, 0) + 1

        return {
            "total_quizzes": total_quizzes,
            "average_score": round(avg_score, 1),
            "total_xp": total_xp,
            "topics_explored": topics_explored,
            "subject_breakdown": breakdown
        }
    except Exception as e:
        print(f"[ERROR] Failed to query detailed user stats: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database aggregation error: {str(e)}")

class VideoGenerationRequest(BaseModel):
    topic: str

def run_video_generation_sync(topic: str) -> str:
    loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        return loop.run_until_complete(process_educational_video(topic))
    finally:
        loop.close()

@app.post("/api/generate-video")
async def generate_video(payload: VideoGenerationRequest, current_user: User = Depends(get_current_user)):
    topic = payload.topic.strip()
    if not topic:
        raise HTTPException(status_code=400, detail="Topic cannot be empty.")
    
    try:
        video_file_path = await asyncio.wait_for(
            asyncio.to_thread(run_video_generation_sync, topic),
            timeout=120.0
        )
        filename = os.path.basename(video_file_path)
        return {"videoUrl": f"http://localhost:8000/static/videos/{filename}"}
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail="Video generation timed out.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Video generation failed: {str(e)}")

# =========================================================
# 🔒 MANDATORY SECURITY AUTHENTICATION GATEWAY
# =========================================================
class LoginRequest(BaseModel):
    username: str
    password: str

class RegisterRequest(BaseModel):
    username: str
    password: str
    email: str = None

@app.post("/api/auth/register")
@limiter.limit(LIMIT_REGISTER)
async def register(request: Request, credentials: RegisterRequest, db: AsyncSession = Depends(get_db)):
    username_clean = credentials.username.strip().lower()
    if len(username_clean) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters long.")
    if len(credentials.password) < 4:
        raise HTTPException(status_code=400, detail="Password must be at least 4 characters long.")

    # Check if user already exists
    stmt = select(User).filter(User.username == username_clean)
    existing_user_result = await db.execute(stmt)
    existing_user = existing_user_result.scalars().first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already exists. Please choose a different name.")

    hashed_pw = get_password_hash(credentials.password)
    new_user = User(username=username_clean, email=credentials.email, hashed_password=hashed_pw)
    db.add(new_user)
    try:
        await db.commit()
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Database registration error: {str(e)}")
        
    return {"status": "success", "message": "User registered successfully."}

@app.post("/api/auth/login")
@limiter.limit(LIMIT_LOGIN)
async def login(request: Request, credentials: LoginRequest, db: AsyncSession = Depends(get_db)):
    sanitized_username = credentials.username.strip().lower()
    sanitized_password = credentials.password.strip()

    # Query database for user
    stmt = select(User).filter(User.username == sanitized_username)
    result = await db.execute(stmt)
    user = result.scalars().first()

    # If the user is narendra, check with default fallback if not in DB
    is_valid = False
    if user:
        if verify_password(sanitized_password, user.hashed_password):
            is_valid = True
    elif sanitized_username == "narendra" and sanitized_password == "admin123":
        # Automatically register the developer account so it works in the future
        hashed_pw = get_password_hash("admin123")
        developer_user = User(username="narendra", email="narendrakillari181203@gmail.com", hashed_password=hashed_pw)
        db.add(developer_user)
        await db.commit()
        is_valid = True

    if is_valid:
        print(f"[AUTH] Authentication Success for user: {credentials.username}")
        expire_time = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRATION_HOURS)
        token_payload = {
            "sub": credentials.username,
            "exp": expire_time
        }
        generated_token = jwt.encode(token_payload, SECRET_KEY, algorithm=ALGORITHM)
        return {
            "access_token": generated_token,
            "token_type": "bearer",
            "username": credentials.username
        }

    raise HTTPException(
        status_code=401,
        detail="Authentication failed. Invalid username or password."
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
import asyncio
import os
import json

from dotenv import load_dotenv
from google.antigravity import Agent, LocalAgentConfig

# Unified MoviePy v1.x / v2.x stable imports
try:
    from moviepy.editor import ColorClip, ImageClip, CompositeVideoClip, concatenate_videoclips
    from moviepy.audio.io.AudioFileClip import AudioFileClip
except ImportError:
    try:
        from moviepy import ColorClip, ImageClip, CompositeVideoClip, concatenate_videoclips, AudioFileClip
    except ImportError:
        from moviepy.video.VideoClip import ColorClip, ImageClip
        from moviepy.video.compositing.CompositeVideoClip import CompositeVideoClip
        from moviepy.video.compositing.concatenate import concatenate_videoclips
        from moviepy.audio.io.AudioFileClip import AudioFileClip

from PIL import Image, ImageDraw, ImageFont
# pyrefly: ignore [missing-import]
import edge_tts

# Load environment variables from .env file
load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_VIDEOS_DIR = os.path.join(BASE_DIR, "static", "videos")

SYSTEM_INSTRUCTIONS = (
    "You are an Expert Educational Video Director. You take a complex technical topic and "
    "output exactly a valid JSON array of scenes. Do not include markdown codeblocks or extra conversational text. "
    "Each scene object must strictly follow this format: "
    "{\"sequence\": 1, \"narration\": \"Text to be spoken\", \"slide_visuals\": [\"Visual bullet or point 1\", \"Visual bullet or point 2\"]}"
)

async def generate_voiceover(text: str, output_path: str):
    """Generates a free, high-quality audio file using edge-tts completely locally."""
    communicate = edge_tts.Communicate(text, "en-US-ChristopherNeural")
    await communicate.save(output_path)

def build_video_scene(slide_visuals: list[str], duration: float, scene_num: int) -> CompositeVideoClip:
    """Builds a slideshow video component using Pillow for text rendering of each visual item."""
    num_visuals = len(slide_visuals)
    if num_visuals == 0:
        slide_visuals = [""]
        num_visuals = 1
        
    item_duration = duration / num_visuals
    
    bg = ColorClip(size=(1920, 1080), color=(15, 23, 42), duration=duration)
    
    txt_clips = []
    start_time = 0.0
    for idx, title_text in enumerate(slide_visuals):
        img = Image.new("RGBA", (1920, 1080), (0, 0, 0, 0))
        draw = ImageDraw.Draw(img)
        
        try:
            font = ImageFont.truetype("arial.ttf", 60)
        except IOError:
            font = ImageFont.load_default()
            
        words = title_text.split(" ")
        lines = []
        current_line = []
        for word in words:
            current_line.append(word)
            temp_line = " ".join(current_line)
            bbox = draw.textbbox((0, 0), temp_line, font=font)
            w = bbox[2] - bbox[0]
            if w > 1500:
                current_line.pop()
                lines.append(" ".join(current_line))
                current_line = [word]
        if current_line:
            lines.append(" ".join(current_line))
            
        total_height = 0
        line_heights = []
        for line in lines:
            bbox = draw.textbbox((0, 0), line, font=font)
            h = bbox[3] - bbox[1]
            line_heights.append(h)
            total_height += h + 15
            
        y = (1080 - total_height) // 2
        for line, h in zip(lines, line_heights):
            bbox = draw.textbbox((0, 0), line, font=font)
            w = bbox[2] - bbox[0]
            x = (1920 - w) // 2
            draw.text((x, y), line, font=font, fill=(255, 255, 255, 255))
            y += h + 15
            
        os.makedirs(STATIC_VIDEOS_DIR, exist_ok=True)
        temp_img_path = os.path.join(STATIC_VIDEOS_DIR, f"temp_text_{scene_num}_{idx}.png")
        img.save(temp_img_path)
        
        txt_clip = ImageClip(temp_img_path)
        
        if hasattr(txt_clip, "with_duration"):
            txt_clip = txt_clip.with_duration(item_duration)
        else:
            txt_clip = txt_clip.set_duration(item_duration)
            
        if hasattr(txt_clip, "with_position"):
            txt_clip = txt_clip.with_position("center")
        else:
            txt_clip = txt_clip.set_position("center")
            
        if hasattr(txt_clip, "with_start"):
            txt_clip = txt_clip.with_start(start_time)
        else:
            txt_clip = txt_clip.set_start(start_time)
            
        txt_clips.append(txt_clip)
        start_time += item_duration
        
    return CompositeVideoClip([bg] + txt_clips)

async def process_educational_video(topic: str) -> str:
    """Orchestrates the entire agentic synthesis pipeline from prompt to finished file."""
    config = LocalAgentConfig(system_instructions=SYSTEM_INSTRUCTIONS)
    
    async with Agent(config) as orchestrator:
        prompt = f"Break down the topic '{topic}' into exactly 2 sequential, high-impact instructional scenes."
        response = await orchestrator.chat(prompt)
        raw_text = await response.text()
        
        clean_json = raw_text.replace("```json", "").replace("```", "").strip()
        scenes = json.loads(clean_json)
        
        video_clips = []
        audio_clips_reference = []  # Track references to close them cleanly later
        
        for scene in scenes:
            seq = scene["sequence"]
            narration = scene["narration"]
            visuals = scene.get("slide_visuals", [])
            
            audio_path = os.path.join(STATIC_VIDEOS_DIR, f"temp_audio_{seq}.mp3")
            await generate_voiceover(narration, audio_path)
            
            audio_clip = AudioFileClip(audio_path)
            audio_clips_reference.append(audio_clip)  # Keep track for closing
            duration = audio_clip.duration
            
            visual_clip = build_video_scene(visuals, duration, seq)
            
            # Cross-version compatibility fix for audio assignment
            if hasattr(visual_clip, "with_audio"):
                visual_clip = visual_clip.with_audio(audio_clip)
            else:
                visual_clip = visual_clip.set_audio(audio_clip)
                
            video_clips.append(visual_clip)
            
        final_timeline = concatenate_videoclips(video_clips)
        output_filename = os.path.join(STATIC_VIDEOS_DIR, f"{topic.lower().replace(' ', '_')}_lesson.mp4")
        
        final_timeline.write_videofile(output_filename, fps=24, codec="libx264", audio_codec="aac")
        
        # Explicit Resource Cleanup to free local file locks
        final_timeline.close()
        for v_clip in video_clips:
            # Safely close all inner image and color clips
            for subclip in getattr(v_clip, "clips", []):
                try:
                    subclip.close()
                except Exception:
                    pass
            v_clip.close()
        for a_clip in audio_clips_reference:
            a_clip.close()
            
        # Safe Housekeeping
        for scene in scenes:
            seq = scene["sequence"]
            audio_path = os.path.join(STATIC_VIDEOS_DIR, f"temp_audio_{seq}.mp3")
            
            if os.path.exists(audio_path):
                try:
                    os.remove(audio_path)
                except Exception:
                    pass
                    
            visuals = scene.get("slide_visuals", [])
            for idx in range(len(visuals)):
                text_path = os.path.join(STATIC_VIDEOS_DIR, f"temp_text_{seq}_{idx}.png")
                if os.path.exists(text_path):
                    try:
                        os.remove(text_path)
                    except Exception:
                        pass
                
        return output_filename

if __name__ == "__main__":
    os.makedirs(STATIC_VIDEOS_DIR, exist_ok=True)
    topic = "Model Context Protocol"
    print(f"Generating educational video for: {topic}...")
    try:
        output = asyncio.run(process_educational_video(topic))
        print(f"Video generated successfully! Path: {output}")
    except Exception as e:
        print(f"Error during video generation: {e}")
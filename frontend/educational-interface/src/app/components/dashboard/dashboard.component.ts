import { Component, ViewChild, ElementRef, ChangeDetectorRef, OnInit, OnDestroy, Input } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser'; 
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';
import { QuizComponent } from './quiz.component';
import { LibraryComponent } from './library.component';
import { NotesComponent } from './notes.component';
import { HistoryComponent } from './history.component';
import { BookmarksComponent } from './bookmarks.component';
import { AnalyticsComponent } from './analytics.component';

export interface LessonContent {
  topic: string;
  subject: string;
  grade: string;
  videoUrl: string;
  keyPoints: string[];
  quizQuestion: string;
  quizOptions: string[];
  correctAnswerIndex: number;
}

export interface RecommendedLesson {
  topic: string;
  subject: string;
  grade: string;
  duration: string;
  videoUrl?: string;
  keyPoints?: string[];
  quizQuestion?: string;
  quizOptions?: string[];
  correctAnswerIndex?: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    QuizComponent,
    LibraryComponent,
    NotesComponent,
    HistoryComponent,
    BookmarksComponent,
    AnalyticsComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
  @Input() username: string = '';
  @ViewChild('chatViewport') private chatViewport!: ElementRef;
  @ViewChild('localPlayer') localPlayer!: ElementRef<HTMLVideoElement>;

  // Navigation & Tabs
  activeNav: string = 'Home';
  rightSidebarTab: string = 'Key Points';
  
  // Search & Generator States
  searchQuery: string = '';
  isGenerating: boolean = false;
  hasData: boolean = false;
  generationTime: string = '2.4s';

  // Dynamic Content States (Initialized to empty/null)
  topicTitle: string = '';
  metaBadges: string[] = [];
  videoUrl: SafeResourceUrl | null = null;
  keyPoints: string[] = [];
  relatedTopics: string[] = [];
  quizQuestion: string | null = null;
  quizOptions: string[] = [];
  correctAnswerIndex: number = -1;
  streakDays: number = 0;
  levelXP: number = 0;

  // Custom Video Player states
  player: any = null;
  isPlaying: boolean = false;
  currentTime: number = 0;
  duration: number = 0;
  volume: number = 50;
  currentQuality: string = 'Auto';
  videoSummary: string = '';
  isYouTube: boolean = false;
  rawVideoUrl: string = '';
  private timerInterval: any = null;

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef, private sanitizer: DomSanitizer) {}

  ngOnInit(): void {
    this.initYouTubeAPI();
  }

  ngOnDestroy(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  initYouTubeAPI(): void {
    if (!(window as any)['YT']) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      (window as any).onYouTubeIframeAPIReady = () => {
        console.log('🎬 YouTube API loaded successfully.');
      };
    }
  }

  // Contextual Chat states
  chatInput: string = '';
  chatMessages: { sender: string; text: string }[] = [];

  // Quiz State
  selectedQuizOption: number | null = null;

  // Toast message
  toastMessage: string = '';

  // Predefined Mock Database
  mockLessons: LessonContent[] = [
    {
      topic: 'Photosynthesis',
      subject: 'Biology',
      grade: 'Class 10',
      videoUrl: 'assets/lessons/photosynthesis.mp4',
      keyPoints: [
        'Light Reactions split water molecules within the thylakoid membranes, generating oxygen gas and energy intermediates ATP/NADPH.',
        'The Calvin Cycle happens inside the stroma, binding inorganic Carbon Dioxide (CO2) into organic glucose sugar chains.',
        'Chlorophyll absorbs light energy, primarily in the blue and red spectrums, while reflecting green wavelengths.'
      ],
      quizQuestion: 'Which section of the chloroplast organelle does the carbon-fixing Calvin Cycle take place in?',
      quizOptions: [
        'Thylakoid Membrane',
        'Stroma Matrix',
        'Outer Envelope',
        'Lumen Cavity'
      ],
      correctAnswerIndex: 1
    },
    {
      topic: 'Cellular Respiration',
      subject: 'Biology',
      grade: 'Class 10',
      videoUrl: 'assets/lessons/respiration.mp4',
      keyPoints: [
        'Glycolysis splits glucose into pyruvate in the cytoplasm, yielding 2 ATP molecules without oxygen.',
        'The Krebs Cycle cycles pyruvate inside the mitochondrial matrix to generate NADH/FADH2 carriers.',
        'The Electron Transport Chain yields the bulk of ATP (around 32-34 molecules) along the inner membrane.'
      ],
      quizQuestion: 'Which component yields the highest volume of ATP during cellular respiration?',
      quizOptions: [
        'Glycolysis',
        'Krebs Cycle',
        'Electron Transport Chain',
        'Fermentation'
      ],
      correctAnswerIndex: 2
    },
    {
      topic: 'Quantum Mechanics',
      subject: 'Physics',
      grade: 'Class 12',
      videoUrl: 'assets/lessons/quantum.mp4',
      keyPoints: [
        'Superposition permits qubits to represent 0 and 1 states simultaneously until measured.',
        'Quantum Entanglement couples particle states instantaneously across arbitrary spatial separation.',
        'Wave-Particle Duality highlights that light and atoms express both wave-like interference and particle-like impacts.'
      ],
      quizQuestion: 'What quantum physics property binds qubit states instantly across distant coordinates?',
      quizOptions: [
        'Coherence',
        'Entanglement',
        'Superposition',
        'Superconductivity'
      ],
      correctAnswerIndex: 1
    }
  ];

  recommendedLessons: RecommendedLesson[] = [
    {
      topic: 'Cellular Respiration',
      subject: 'Biology',
      grade: 'Class 10',
      duration: '8 min',
      videoUrl: 'assets/lessons/respiration.mp4',
      keyPoints: [
        'Glycolysis splits glucose into pyruvate in the cytoplasm, yielding 2 ATP molecules without oxygen.',
        'The Krebs Cycle cycles pyruvate inside the mitochondrial matrix to generate NADH/FADH2 carriers.',
        'The Electron Transport Chain yields the bulk of ATP (around 32-34 molecules) along the inner membrane.'
      ],
      quizQuestion: 'Which component yields the highest volume of ATP during cellular respiration?',
      quizOptions: [
        'Glycolysis',
        'Krebs Cycle',
        'Electron Transport Chain',
        'Fermentation'
      ],
      correctAnswerIndex: 2
    },
    {
      topic: 'Quantum Mechanics',
      subject: 'Physics',
      grade: 'Class 12',
      duration: '12 min',
      videoUrl: 'assets/lessons/quantum.mp4',
      keyPoints: [
        'Superposition permits qubits to represent 0 and 1 states simultaneously until measured.',
        'Quantum Entanglement couples particle states instantaneously across arbitrary spatial separation.',
        'Wave-Particle Duality highlights that light and atoms express both wave-like interference and particle-like impacts.'
      ],
      quizQuestion: 'What quantum physics property binds qubit states instantly across distant coordinates?',
      quizOptions: [
        'Coherence',
        'Entanglement',
        'Superposition',
        'Superconductivity'
      ],
      correctAnswerIndex: 1
    }
  ];

  // Helper wait
  private wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Handle workspace launching from sub-panels
  onTopicSelected(topic: string): void {
    this.activeNav = 'Home';
    this.onGenerate(topic);
  }

  // Generate video lesson from the backend API
  onGenerate(query?: string): void {
    const searchVal = query || this.searchQuery;
    if (!searchVal || !searchVal.trim()) {
      return;
    }

    this.searchQuery = searchVal.trim();
    this.isGenerating = true;
    this.hasData = false;

    console.log('🚀 Angular sending request to backend for:', this.searchQuery);

    this.apiService.generateWorkspace(this.searchQuery).subscribe({
      next: (response) => {
        console.log('✅ Backend responded successfully! Data received:', response);
        // Map backend payload parameters straight to UI layout state properties
        this.topicTitle = response.topic;

        const rawUrl = response.videoUrl;
        this.rawVideoUrl = rawUrl;
        // 🌟 BYPASS ANTI-XSS INTERCEPTOR FIREWALL SAFELY:
        this.videoUrl = this.sanitizer.bypassSecurityTrustResourceUrl(rawUrl);
        this.videoSummary = response.videoSummary || '';
        this.recommendedLessons = response.recommendedLessons || [];
        
        this.keyPoints = response.keyPoints || [];
        this.quizQuestion = response.quizQuestion;
        this.quizOptions = response.quizOptions || [];
        this.correctAnswerIndex = response.correctAnswerIndex ?? -1;
        this.streakDays = response.streakDays || 0;
        this.levelXP = response.levelXP || 0;

        // Extract metadata or construct badges
        const subject = response.subject || 'Science';
        const grade = response.grade || 'General';
        this.metaBadges = [subject, grade, 'Explained in 2.4s'];
        this.relatedTopics = response.relatedTopics || ['Overview', 'Fundamentals', 'Advanced Study'];

        this.selectedQuizOption = null;
        this.chatMessages = [];
        
        // Explicitly set flags to turn off loading state
        this.hasData = true;
        this.isGenerating = false;

        // 🌟 FORCE ANGULAR TO VISUALLY RE-RENDER THE DASHBOARD MATRIX RIGHT NOW:
        this.cdr.detectChanges();

        // 🎬 NOW INITIALIZE THE PLAYER AFTER THE DOM PLACEHOLDER HAS RENDERED
        this.initPlayer(rawUrl);

        console.log('✨ UI State flags updated. hasData:', this.hasData, 'isGenerating:', this.isGenerating);
        this.showToast(`Lesson Generated: ${this.topicTitle}`);
      },
      error: (err) => {
        console.error('❌ Angular HTTP error intercepted:', err);
        this.showToast('Failed to generate lesson.');
        this.isGenerating = false;
      }
    });
  }

  // Get dynamic suggestions for chat
  getPredefinedQuestions(): string[] {
    const base = ['Summarize the video'];
    if (!this.topicTitle) {
      return [...base, 'What are the core concepts?', 'How does it work?'];
    }
    const title = this.topicTitle.toLowerCase();
    if (title.includes('photo')) {
      return [...base, 'What is the Calvin cycle?', 'Why is chlorophyll green?', 'What are light reactions?'];
    } else if (title.includes('respiration')) {
      return [...base, 'What is glycolysis?', 'What does Krebs cycle produce?', 'Where does ETC happen?'];
    } else {
      return [...base, 'What are the core concepts?', 'How does it work?'];
    }
  }

  // Badge utility class
  getBadgeClass(badge: string): string {
    const b = badge.toLowerCase();
    if (b.includes('biology') || b.includes('science') || b.includes('physics')) {
      return 'subject';
    } else if (b.includes('class') || b.includes('grade')) {
      return 'grade';
    } else {
      return 'tracker';
    }
  }

  // Circular progress streak tracker background
  getStreakBackground(): string {
    const percent = Math.min(100, (this.streakDays / 30) * 100);
    return `conic-gradient(#6366f1 ${percent}%, #1f293d ${percent}% 100%)`;
  }

  // Ask Anything Chat
  sendChat(): void {
    if (!this.chatInput.trim()) {
      return;
    }
    const userText = this.chatInput;
    this.chatMessages.push({ sender: 'user', text: userText });
    this.chatInput = '';
    this.scrollToBottom();

    // Call dynamic backend Q&A endpoint
    this.apiService.askQuestion(this.topicTitle, this.rawVideoUrl || '', this.videoSummary || '', userText).subscribe({
      next: (res) => {
        this.chatMessages.push({ sender: 'ai', text: res.answer });
        this.scrollToBottom();
      },
      error: (err) => {
        console.error('Chat QA failed:', err);
        this.chatMessages.push({ sender: 'ai', text: `Failed to generate response. Lesson Context Summary: ${this.videoSummary}` });
        this.scrollToBottom();
      }
    });
  }

  sendPredefinedQuestion(question: string): void {
    this.chatMessages.push({ sender: 'user', text: question });
    this.scrollToBottom();

    // Call dynamic backend Q&A endpoint
    this.apiService.askQuestion(this.topicTitle, this.rawVideoUrl || '', this.videoSummary || '', question).subscribe({
      next: (res) => {
        this.chatMessages.push({ sender: 'ai', text: res.answer });
        this.scrollToBottom();
      },
      error: (err) => {
        console.error('Chat QA failed:', err);
        this.chatMessages.push({ sender: 'ai', text: `Failed to generate response. Lesson Context Summary: ${this.videoSummary}` });
        this.scrollToBottom();
      }
    });
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      try {
        if (this.chatViewport) {
          this.chatViewport.nativeElement.scrollTop = this.chatViewport.nativeElement.scrollHeight;
        }
      } catch (err) {
        console.warn('Scroll failed', err);
      }
    }, 100);
  }

  // Quiz helper
  selectOption(index: number): void {
    this.selectedQuizOption = index;
    if (index === this.correctAnswerIndex) {
      this.levelXP += 50;
      this.showToast('Correct! Earned +50 XP');
    } else {
      this.showToast('Incorrect answer.');
    }
  }

  resetQuiz(): void {
    this.selectedQuizOption = null;
  }

  getOptionLetter(index: number): string {
    return String.fromCharCode(65 + index); // A, B, C, D
  }

  // Toast utilities
  showToast(message: string): void {
    this.toastMessage = message;
    setTimeout(() => {
      this.toastMessage = '';
    }, 3000);
  }

  copyToClipboard(text: string): void {
    navigator.clipboard.writeText(text).then(() => {
      this.showToast('Takeaway copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy: ', err);
    });
  }

  triggerUtility(utilityType: string): void {
    this.showToast(`Utility triggered: ${utilityType}`);
  }

  // YouTube Custom Control Logic
  initPlayer(url: string): void {
    if (!url) return;

    const isYT = url.includes('youtube.com') || url.includes('youtu.be');
    if (!isYT) {
      console.log('ℹ️ Local video detected (playing via HTML5 video element):', url);
      this.isYouTube = false;
      this.isPlaying = false;
      this.currentTime = 0;
      this.duration = 0;
      if (this.player) {
        try {
          this.player.destroy();
        } catch (e) {
          console.error('Error destroying player:', e);
        }
        this.player = null;
      }
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
      this.cdr.detectChanges();
      return;
    }

    this.isYouTube = true;
    this.cdr.detectChanges();

    if (this.player) {
      try {
        this.player.destroy();
      } catch (e) {
        console.error('Error destroying player:', e);
      }
      this.player = null;
    }

    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }

    this.isPlaying = false;
    this.currentTime = 0;
    this.duration = 0;

    const YTGlobal = (window as any)['YT'];
    if (YTGlobal && YTGlobal.Player) {
      this.createPlayerInstanceFromUrl(url);
    } else {
      const checkInterval = setInterval(() => {
        const PollYT = (window as any)['YT'];
        if (PollYT && PollYT.Player) {
          clearInterval(checkInterval);
          this.createPlayerInstanceFromUrl(url);
        }
      }, 200);
    }
  }

  createPlayerInstanceFromUrl(url: string): void {
    const YTGlobal = (window as any)['YT'];
    const videoId = this.extractYouTubeId(url);
    
    let playerOptions: any = {
      height: '100%',
      width: '100%',
      events: {
        'onReady': (event: any) => this.onPlayerReady(event),
        'onStateChange': (event: any) => this.onPlayerStateChange(event)
      }
    };

    let isListParsed = false;
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const urlObj = new URL(url);
        const listType = urlObj.searchParams.get('listType');
        const listVal = urlObj.searchParams.get('list');
        if (listType && listVal) {
          playerOptions.playerVars = {
            listType: listType,
            list: listVal,
            autoplay: 1,
            mute: 1,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            enablejsapi: 1
          };
          isListParsed = true;
        }
      }
    } catch (e) {
      console.warn('URL parsing failed inside player builder:', e);
    }

    if (!isListParsed && videoId) {
      playerOptions.videoId = videoId;
      playerOptions.playerVars = {
        autoplay: 1,
        mute: 1,
        loop: 1,
        playlist: videoId,
        controls: 0,
        modestbranding: 1,
        rel: 0,
        enablejsapi: 1
      };
    }

    this.player = new YTGlobal.Player('yt-player-placeholder', playerOptions);
  }

  onPlayerReady(event: any): void {
    this.player.setVolume(this.volume);
    this.duration = Math.floor(this.player.getDuration() || 0);
    this.isPlaying = this.player.getPlayerState() === 1;
    this.startTrackingTime();
  }

  onPlayerStateChange(event: any): void {
    const YTGlobal = (window as any)['YT'];
    if (event.data === YTGlobal.PlayerState.PLAYING) {
      this.isPlaying = true;
      this.duration = Math.floor(this.player.getDuration() || 0);
      this.startTrackingTime();
    } else {
      this.isPlaying = false;
    }
    this.cdr.detectChanges();
  }

  startTrackingTime(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
    this.timerInterval = setInterval(() => {
      if (this.player && this.player.getCurrentTime) {
        this.currentTime = Math.floor(this.player.getCurrentTime());
        if (!this.duration) {
          this.duration = Math.floor(this.player.getDuration());
        }
        this.cdr.detectChanges();
      }
    }, 1000);
  }

  togglePlay(): void {
    if (this.isYouTube) {
      if (!this.player) return;
      if (this.isPlaying) {
        this.player.pauseVideo();
        this.isPlaying = false;
      } else {
        this.player.playVideo();
        this.isPlaying = true;
      }
    } else {
      const videoEl = this.localPlayer?.nativeElement;
      if (!videoEl) return;
      if (this.isPlaying) {
        videoEl.pause();
        this.isPlaying = false;
      } else {
        videoEl.play();
        this.isPlaying = true;
      }
    }
    this.cdr.detectChanges();
  }

  onVolumeChange(value: number): void {
    this.volume = value;
    if (this.isYouTube) {
      if (this.player && this.player.setVolume) {
        this.player.setVolume(this.volume);
      }
    } else {
      const videoEl = this.localPlayer?.nativeElement;
      if (videoEl) {
        videoEl.volume = this.volume / 100;
        videoEl.muted = this.volume === 0;
      }
    }
    this.cdr.detectChanges();
  }

  onSeekChange(value: number): void {
    if (this.isYouTube) {
      if (this.player && this.player.seekTo) {
        this.player.seekTo(value, true);
        this.currentTime = value;
      }
    } else {
      const videoEl = this.localPlayer?.nativeElement;
      if (videoEl) {
        videoEl.currentTime = value;
        this.currentTime = value;
      }
    }
    this.cdr.detectChanges();
  }

  onLocalPlayState(playing: boolean): void {
    this.isPlaying = playing;
    this.cdr.detectChanges();
  }

  onLocalTimeUpdate(): void {
    const videoEl = this.localPlayer?.nativeElement;
    if (videoEl) {
      this.currentTime = Math.floor(videoEl.currentTime);
      this.cdr.detectChanges();
    }
  }

  onLocalMetadataLoaded(): void {
    const videoEl = this.localPlayer?.nativeElement;
    if (videoEl) {
      this.duration = Math.floor(videoEl.duration || 0);
      this.isPlaying = !videoEl.paused;
      videoEl.volume = this.volume / 100;
      videoEl.muted = this.volume === 0;
      this.cdr.detectChanges();
    }
  }

  onQualityChange(quality: string): void {
    this.currentQuality = quality;
    this.showToast(`Video Quality optimized to: ${quality}`);
    
    if (this.player && this.player.setPlaybackQuality) {
      const qMap: any = {
        '1080p': 'hd1080',
        '720p': 'hd720',
        '480p': 'large',
        'Auto': 'default'
      };
      this.player.setPlaybackQuality(qMap[quality] || 'default');
    }
  }

  extractYouTubeId(url: string): string | null {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const minStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
    const secStr = secs < 10 ? `0${secs}` : `${secs}`;
    return `${minStr}:${secStr}`;
  }
}

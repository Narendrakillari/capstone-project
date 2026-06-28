import { Component, ChangeDetectorRef, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-quiz',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quiz.component.html',
  styleUrls: ['./quiz.component.css']
})
export class QuizComponent implements OnInit {
  @Input() username: string = '';

  // Navigation State Switch
  currentView: 'dashboard' | 'arena' = 'dashboard';
  quizSearchQuery: string = '';
  isGenerating: boolean = false;

  // Quizzes Taken Counter and persistent state variables
  quizzesTakenCount: number = 0;
  hasQuizHistory: boolean = false;
  averageScore: number = 0;
  totalXP: number = 0;

  // Question Engine States
  generatedTopicTitle: string = '';
  questionsDeck: any[] = [];
  currentQuestionIndex: number = 0;
  selectedAnswerIndex: number | null = null;
  accumulatedScore: number = 0;

  // Overview Mock Data Collections
  recentQuizzes = [
    { title: 'JavaScript Basics', category: 'Programming', score: 72, date: 'May 21, 2025' },
    { title: 'Geography of India', category: 'Geography', score: 90, date: 'May 20, 2025' }
  ];

  recommendedQuizzes = [
    { title: 'Neurons and Nervous System', category: 'Biology', qCount: 12 },
    { title: 'Data Structures in C++', category: 'Programming', qCount: 15 },
    { title: 'Light and Reflection', category: 'Physics', qCount: 10 }
  ];

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.loadUserStats();
  }

  loadUserStats() {
    const user = this.username || localStorage.getItem('sessionUser') || 'narendra';
    this.apiService.getUserStats(user).subscribe({
      next: (res) => {
        this.quizzesTakenCount = res.total_quizzes;
        this.averageScore = res.average_score;
        this.totalXP = res.total_xp;
        this.hasQuizHistory = res.total_quizzes > 0;
        
        if (res.recent_quizzes && res.recent_quizzes.length > 0) {
          this.recentQuizzes = res.recent_quizzes.map((q: any) => ({
            title: q.title,
            category: 'General',
            score: q.score,
            date: q.date
          }));
        } else {
          this.recentQuizzes = [];
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Failed to load user stats:', err);
      }
    });
  }

  startCustomQuiz(topic: string) {
    if (!topic || !topic.trim()) return;

    this.currentView = 'arena';
    this.isGenerating = true;
    this.currentQuestionIndex = 0;
    this.selectedAnswerIndex = null;
    this.accumulatedScore = 0;

    this.apiService.generateQuiz(topic).subscribe({
      next: (response) => {
        this.generatedTopicTitle = response.topic;
        this.questionsDeck = response.questions || [];
        this.isGenerating = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Quiz routing error:', err);
        this.isGenerating = false;
      }
    });
  }

  evaluateAnswerSelection(selectedIndex: number) {
    if (this.selectedAnswerIndex !== null) return;
    this.selectedAnswerIndex = selectedIndex;
    if (selectedIndex === this.questionsDeck[this.currentQuestionIndex].correctIndex) {
      this.accumulatedScore++;
    }
  }

  advanceToNextQuestion() {
    if (this.currentQuestionIndex < 9) {
      this.currentQuestionIndex++;
      this.selectedAnswerIndex = null;
    } else {
      const user = this.username || localStorage.getItem('sessionUser') || 'narendra';
      const score = this.accumulatedScore * 10;
      
      this.apiService.saveQuizScore(user, this.generatedTopicTitle, score, this.accumulatedScore).subscribe({
        next: () => {
          console.log('Quiz score persisted successfully');
          this.loadUserStats(); // dynamically refresh dashboard KPIs and history tables
        },
        error: (err) => {
          console.error('Failed to save quiz score:', err);
        }
      });

      this.quizzesTakenCount++;
      alert(`🎯 Quiz Finished! Evaluation complete: ${score}/100 Points.`);
      this.exitQuizArena();
    }
    this.cdr.detectChanges();
  }

  exitQuizArena() {
    this.currentView = 'dashboard';
    this.quizSearchQuery = '';
    this.cdr.detectChanges();
  }

  getLetterPrefix(index: number): string {
    return String.fromCharCode(65 + index);
  }
}
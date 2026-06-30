import { Component, OnInit, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';

export interface KPIStats {
  label: string;
  value: string;
  subtext: string;
  colorClass: string;
}

export interface SubjectXP {
  subject: string;
  xp: number;
  percentage: number;
  color: string;
}

export interface Achievement {
  title: string;
  description: string;
  unlockedAt: string;
  icon: string;
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.css']
})
export class AnalyticsComponent implements OnInit {
  @Input() username: string = '';

  isLoading: boolean = false;

  stats: KPIStats[] = [
    { label: 'Total Quizzes', value: '0', subtext: 'Quizzes completed', colorClass: 'purple' },
    { label: 'Average Score', value: '0%', subtext: 'Across all subjects', colorClass: 'green' },
    { label: 'Topics Explored', value: '0', subtext: 'Unique generated topics', colorClass: 'blue' },
    { label: 'Total XP', value: '0', subtext: 'Experience points accumulated', colorClass: 'gold' }
  ];

  subjectDistributions: SubjectXP[] = [];

  achievements: Achievement[] = [
    { title: 'Streak Explorer', description: 'Maintain a 10-day learning streak.', unlockedAt: 'Unlocked yesterday', icon: '🔥' },
    { title: 'Polymath Mindset', description: 'Generate workspaces in 5 different subjects.', unlockedAt: 'Unlocked 3 days ago', icon: '🧠' },
    { title: 'Arena Gladiator', description: 'Score 100/100 on a Practice Arena quiz.', unlockedAt: 'Unlocked last week', icon: '🏆' }
  ];

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadDetailedStats();
  }

  loadDetailedStats(): void {
    this.isLoading = true;
    this.apiService.getDetailedStats().subscribe({
      next: (res) => {
        this.isLoading = false;
        this.stats = [
          { label: 'Total Quizzes', value: res.total_quizzes.toString(), subtext: 'Quizzes completed', colorClass: 'purple' },
          { label: 'Average Score', value: `${res.average_score}%`, subtext: 'Across all subjects', colorClass: 'green' },
          { label: 'Topics Explored', value: res.topics_explored.toString(), subtext: 'Unique generated topics', colorClass: 'blue' },
          { label: 'Total XP', value: res.total_xp.toString(), subtext: 'Experience points accumulated', colorClass: 'gold' }
        ];

        const subjects = Object.keys(res.subject_breakdown || {});
        if (subjects.length > 0) {
          const maxCount = Math.max(...Object.values(res.subject_breakdown) as number[]);
          const colors = ['#10b981', '#06b6d4', '#a855f7', '#f59e0b', '#ef4444', '#3b82f6'];

          this.subjectDistributions = subjects.map((sub, idx) => {
            const count = res.subject_breakdown[sub];
            const percent = maxCount > 0 ? Math.round((count / maxCount) * 100) : 0;
            return {
              subject: sub.charAt(0).toUpperCase() + sub.slice(1),
              xp: count * 50,
              percentage: percent,
              color: colors[idx % colors.length]
            };
          });
        } else {
          this.subjectDistributions = [];
        }
      },
      error: (err) => {
        console.error('Failed to load detailed analytics:', err);
        this.isLoading = false;
      }
    });
  }
}

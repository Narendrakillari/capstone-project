import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

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
export class AnalyticsComponent {
  stats: KPIStats[] = [
    { label: 'Total Study Time', value: '14.5 hrs', subtext: '↑ 2.4 hrs this week', colorClass: 'purple' },
    { label: 'Quiz Success Rate', value: '78.5%', subtext: '↑ 4.2% since last week', colorClass: 'green' },
    { label: 'Topics Explored', value: '18', subtext: '8 categories generated', colorClass: 'blue' },
    { label: 'Global Ranking', value: 'Top 8%', subtext: '↑ 2% in leaderboard', colorClass: 'gold' }
  ];

  subjectDistributions: SubjectXP[] = [
    { subject: 'Biology', xp: 950, percentage: 75, color: '#10b981' },
    { subject: 'Physics', xp: 550, percentage: 45, color: '#06b6d4' },
    { subject: 'Chemistry', xp: 400, percentage: 32, color: '#a855f7' },
    { subject: 'Maths', xp: 300, percentage: 24, color: '#f59e0b' },
    { subject: 'History', xp: 250, percentage: 20, color: '#ef4444' }
  ];

  achievements: Achievement[] = [
    { title: 'Streak Explorer', description: 'Maintain a 10-day learning streak.', unlockedAt: 'Unlocked yesterday', icon: '🔥' },
    { title: 'Polymath Mindset', description: 'Generate workspaces in 5 different subjects.', unlockedAt: 'Unlocked 3 days ago', icon: '🧠' },
    { title: 'Arena Gladiator', description: 'Score 100/100 on a Practice Arena quiz.', unlockedAt: 'Unlocked last week', icon: '🏆' }
  ];
}

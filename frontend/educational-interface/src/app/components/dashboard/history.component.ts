import { Component, EventEmitter, Output, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

export interface HistoryItem {
  id: number;
  type: 'workspace' | 'quiz' | 'note';
  title: string;
  category: string;
  timestamp: string;
  description: string;
  extraMeta?: string;
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.css']
})
export class HistoryComponent implements OnInit {
  @Input() username: string = '';
  @Output() topicSelected = new EventEmitter<string>();

  selectedType: string = 'All';
  isLoading: boolean = false;
  historyItems: HistoryItem[] = [];

  constructor(private apiService: ApiService) {}

  ngOnInit(): void {
    this.loadHistory();
  }

  loadHistory() {
    const user = this.username || localStorage.getItem('sessionUser') || 'narendra';
    this.isLoading = true;
    this.apiService.getHistory(user).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.recent_quizzes && res.recent_quizzes.length > 0) {
          this.historyItems = res.recent_quizzes.map((q: any, index: number) => ({
            id: index + 1,
            type: 'quiz',
            title: q.title,
            category: 'General',
            timestamp: q.date,
            description: `Completed multiple-choice practice quiz in the evaluation arena.`,
            extraMeta: `Score: ${q.score}/100`
          }));
        } else {
          this.historyItems = [];
        }
      },
      error: (err) => {
        console.error('Failed to load history:', err);
        this.isLoading = false;
        this.historyItems = [];
      }
    });
  }

  getFilteredHistory(): HistoryItem[] {
    if (this.selectedType === 'All') {
      return this.historyItems;
    }
    return this.historyItems.filter(item => item.type === this.selectedType.toLowerCase());
  }

  filterHistory(type: string) {
    this.selectedType = type;
  }

  getIcon(type: 'workspace' | 'quiz' | 'note'): string {
    switch (type) {
      case 'workspace': return '📺';
      case 'quiz': return '🎯';
      case 'note': return '📝';
      default: return '📍';
    }
  }

  launchTopic(topic: string) {
    const cleanTopic = topic.replace(' Arena', '').replace(' Notes', '');
    this.topicSelected.emit(cleanTopic);
  }

  clearHistory() {
    if (confirm('Are you sure you want to clear your study history?')) {
      this.historyItems = [];
    }
  }
}

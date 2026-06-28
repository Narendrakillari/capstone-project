import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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
export class HistoryComponent {
  @Output() topicSelected = new EventEmitter<string>();

  selectedType: string = 'All';

  historyItems: HistoryItem[] = [
    {
      id: 1,
      type: 'workspace',
      title: 'Photosynthesis',
      category: 'Biology',
      timestamp: 'Today, 2:15 PM',
      description: 'Generated AI lecture video, mind maps, and detailed key takeaways.',
      extraMeta: 'Grade 10 Study Profile'
    },
    {
      id: 2,
      type: 'quiz',
      title: 'Photosynthesis Arena',
      category: 'Biology',
      timestamp: 'Today, 2:30 PM',
      description: 'Completed 10 multiple-choice questions in the practice arena.',
      extraMeta: 'Score: 90/100 (+50 XP)'
    },
    {
      id: 3,
      type: 'note',
      title: 'Cellular Respiration Notes',
      category: 'Biology',
      timestamp: 'Yesterday, 4:10 PM',
      description: 'Updated and compiled personal notes on Glycolysis and Krebs cycle.',
      extraMeta: 'Saved in Study Notes'
    },
    {
      id: 4,
      type: 'workspace',
      title: 'Cellular Respiration',
      category: 'Biology',
      timestamp: 'Yesterday, 3:45 PM',
      description: 'Generated respiratory pathways study workspace and loops.',
      extraMeta: 'Grade 10 Study Profile'
    },
    {
      id: 5,
      type: 'workspace',
      title: 'Quantum Entanglement',
      category: 'Physics',
      timestamp: '3 days ago',
      description: 'Researched quantum superposition, teleportation, and qubit states.',
      extraMeta: 'Grade 12 Study Profile'
    },
    {
      id: 6,
      type: 'quiz',
      title: 'Quantum Physics Arena',
      category: 'Physics',
      timestamp: '3 days ago',
      description: 'Completed evaluation quiz. Reviewed 3 incorrect responses.',
      extraMeta: 'Score: 70/100 (+30 XP)'
    }
  ];

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
    // Strips out "Arena" or "Notes" suffix from titles if they are quizzes/notes
    const cleanTopic = topic.replace(' Arena', '').replace(' Notes', '');
    this.topicSelected.emit(cleanTopic);
  }

  clearHistory() {
    if (confirm('Are you sure you want to clear your study history?')) {
      this.historyItems = [];
    }
  }
}

import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface BookmarkItem {
  id: number;
  type: 'video' | 'keypoint' | 'mindmap' | 'question';
  title: string;
  topic: string;
  category: string;
  contentSnippet: string;
}

@Component({
  selector: 'app-bookmarks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bookmarks.component.html',
  styleUrls: ['./bookmarks.component.css']
})
export class BookmarksComponent {
  @Output() topicSelected = new EventEmitter<string>();

  selectedType: string = 'All';
  toastMessage: string = '';

  bookmarkItems: BookmarkItem[] = [
    {
      id: 1,
      type: 'video',
      title: 'Photosynthesis Thylakoid Loop',
      topic: 'Photosynthesis',
      category: 'Biology',
      contentSnippet: 'Interactive video loop demonstrating electron excitation in PS II and PS I along the thylakoid membrane.'
    },
    {
      id: 2,
      type: 'keypoint',
      title: 'Calvin Cycle Carbon Fixation',
      topic: 'Photosynthesis',
      category: 'Biology',
      contentSnippet: 'The Light-Independent reactions take place in the chloroplast stroma, capturing gaseous CO2 into organic G3P sugar molecules.'
    },
    {
      id: 3,
      type: 'mindmap',
      title: 'Cellular Respiration Branches',
      topic: 'Cellular Respiration',
      category: 'Biology',
      contentSnippet: 'Visual branches connecting Glycolysis (cytoplasm) with Krebs Cycle (matrix) and Electron Transport Chain (membrane).'
    },
    {
      id: 4,
      type: 'question',
      title: 'Quantum Entanglement Coordinate Link',
      topic: 'Quantum Physics',
      category: 'Physics',
      contentSnippet: 'MCQ: "What quantum physics property binds qubit states instantly across distant coordinates?" Answer: Entanglement.'
    }
  ];

  getFilteredBookmarks(): BookmarkItem[] {
    if (this.selectedType === 'All') {
      return this.bookmarkItems;
    }
    return this.bookmarkItems.filter(item => item.type === this.selectedType.toLowerCase());
  }

  filterBookmarks(type: string) {
    this.selectedType = type;
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'video': return '🎥 Video Loop';
      case 'keypoint': return '💡 Key Takeaway';
      case 'mindmap': return '🗺️ Mind Map';
      case 'question': return '🎯 Quiz Question';
      default: return '📍 Resource';
    }
  }

  launchTopic(topic: string) {
    this.topicSelected.emit(topic);
  }

  removeBookmark(id: number, event: Event) {
    event.stopPropagation();
    this.bookmarkItems = this.bookmarkItems.filter(item => item.id !== id);
    this.showToast('Bookmark removed.');
  }

  showToast(message: string) {
    this.toastMessage = message;
    setTimeout(() => {
      this.toastMessage = '';
    }, 2500);
  }
}

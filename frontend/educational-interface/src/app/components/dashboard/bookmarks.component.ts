import { Component, EventEmitter, Output, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BookmarkService } from '../../services/bookmark.service';
import { BookmarkItem } from '../../models/workspace.models';

@Component({
  selector: 'app-bookmarks',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bookmarks.component.html',
  styleUrls: ['./bookmarks.component.css']
})
export class BookmarksComponent implements OnInit {
  @Output() topicSelected = new EventEmitter<string>();

  selectedType: string = 'All';
  toastMessage: string = '';
  bookmarkItems: BookmarkItem[] = [];

  constructor(private bookmarkService: BookmarkService) {}

  ngOnInit(): void {
    this.loadBookmarks();
  }

  loadBookmarks(): void {
    this.bookmarkItems = this.bookmarkService.getBookmarks();
  }

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
    this.bookmarkService.removeBookmark(id);
    this.loadBookmarks();
    this.showToast('Bookmark removed.');
  }

  showToast(message: string) {
    this.toastMessage = message;
    setTimeout(() => {
      this.toastMessage = '';
    }, 2500);
  }
}

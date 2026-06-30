import { Injectable } from '@angular/core';
import { BookmarkItem } from '../models/workspace.models';

@Injectable({
  providedIn: 'root'
})
export class BookmarkService {
  private readonly STORAGE_KEY = 'visuallearn_bookmarks';
  private readonly MAX_LIMIT = 50;

  constructor() {}

  getBookmarks(): BookmarkItem[] {
    const raw = localStorage.getItem(this.STORAGE_KEY);
    if (!raw) {
      return [];
    }
    try {
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  addBookmark(item: Omit<BookmarkItem, 'id'>): BookmarkItem {
    const bookmarks = this.getBookmarks();
    const newItem: BookmarkItem = {
      ...item,
      id: Date.now() + Math.floor(Math.random() * 1000)
    };
    
    bookmarks.push(newItem);
    
    // Limit to 50 bookmarks max (removes oldest if exceeded)
    if (bookmarks.length > this.MAX_LIMIT) {
      bookmarks.shift();
    }
    
    this.save(bookmarks);
    return newItem;
  }

  removeBookmark(id: number): void {
    const bookmarks = this.getBookmarks();
    const filtered = bookmarks.filter(b => b.id !== id);
    this.save(filtered);
  }

  clearAll(): void {
    localStorage.removeItem(this.STORAGE_KEY);
  }

  private save(bookmarks: BookmarkItem[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(bookmarks));
  }
}

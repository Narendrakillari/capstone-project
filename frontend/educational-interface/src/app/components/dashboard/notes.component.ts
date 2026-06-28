import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface NoteItem {
  id: number;
  title: string;
  category: string;
  lastUpdated: string;
  content: string;
}

@Component({
  selector: 'app-notes',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './notes.component.html',
  styleUrls: ['./notes.component.css']
})
export class NotesComponent {
  @Output() topicSelected = new EventEmitter<string>();

  notesList: NoteItem[] = [
    {
      id: 1,
      title: 'Photosynthesis',
      category: 'Biology',
      lastUpdated: '10 mins ago',
      content: `### Photosynthesis Study Notes 🌿

- **Core Definition**: The process by which green plants use sunlight to synthesize nutrients from carbon dioxide and water.
- **Light Reactions**: Occur in the thylakoid membranes. Splits water to release oxygen and generate ATP & NADPH.
- **Calvin Cycle (Light-Independent)**: Occurs in the stroma. Carbon Dioxide (CO2) is fixed to synthesize glucose.

*Reminder: Chlorophyll reflects green wavelengths while absorbing red and blue light!*`
    },
    {
      id: 2,
      title: 'Cellular Respiration',
      category: 'Biology',
      lastUpdated: '1 day ago',
      content: `### Cellular Respiration Study Notes 🧬

- **Glycolysis**: Splitting glucose into pyruvate in the cytoplasm. Yields 2 net ATP.
- **Krebs Cycle**: Occurs in the mitochondrial matrix. Generates NADH & FADH2 carrier molecules.
- **Electron Transport Chain (ETC)**: In the inner mitochondrial membrane. Yields the highest volume of ATP (32-34 molecules).`
    },
    {
      id: 3,
      title: 'Quantum Entanglement',
      category: 'Physics',
      lastUpdated: '3 days ago',
      content: `### Quantum Entanglement Notes ⚛️

- **Entanglement**: Qubits become linked so that the state of one instantly determines the state of the other, regardless of distance.
- **Superposition**: Ability of a qubit to exist in multiple states (0 and 1) simultaneously.
- **Applications**: Secure quantum cryptography, computing speedups, and teleportation protocols.`
    }
  ];

  selectedNoteId: number = 1;
  activeNoteContent: string = '';
  activeNoteTitle: string = '';
  isEditing: boolean = false;
  toastMessage: string = '';

  constructor() {
    this.loadNote(this.selectedNoteId);
  }

  loadNote(id: number) {
    const note = this.notesList.find(n => n.id === id);
    if (note) {
      this.selectedNoteId = id;
      this.activeNoteContent = note.content;
      this.activeNoteTitle = note.title;
      this.isEditing = false;
    }
  }

  startEditing() {
    this.isEditing = true;
  }

  saveNote() {
    const noteIndex = this.notesList.findIndex(n => n.id === this.selectedNoteId);
    if (noteIndex !== -1) {
      this.notesList[noteIndex].content = this.activeNoteContent;
      this.notesList[noteIndex].title = this.activeNoteTitle;
      this.notesList[noteIndex].lastUpdated = 'Just now';
      this.isEditing = false;
      this.showToast('Note saved successfully! 🎉');
    }
  }

  createNewNote() {
    const newId = this.notesList.length > 0 ? Math.max(...this.notesList.map(n => n.id)) + 1 : 1;
    const newNote: NoteItem = {
      id: newId,
      title: 'Untitled Note',
      category: 'General',
      lastUpdated: 'Just now',
      content: '### New Study Notes 📝\n\nStart writing notes, bullet points, or reminders here...'
    };
    this.notesList.unshift(newNote);
    this.loadNote(newId);
    this.isEditing = true;
  }

  deleteNote(id: number, event: Event) {
    event.stopPropagation();
    this.notesList = this.notesList.filter(n => n.id !== id);
    if (this.notesList.length > 0) {
      this.loadNote(this.notesList[0].id);
    } else {
      this.activeNoteTitle = '';
      this.activeNoteContent = '';
      this.selectedNoteId = -1;
    }
    this.showToast('Note deleted.');
  }

  launchWorkspace(topic: string) {
    this.topicSelected.emit(topic);
  }

  showToast(message: string) {
    this.toastMessage = message;
    setTimeout(() => {
      this.toastMessage = '';
    }, 3000);
  }
}

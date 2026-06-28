import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface LibraryItem {
  title: string;
  category: string;
  grade: string;
  description: string;
  lessonsCount: number;
  duration: string;
  progress: number;
}

@Component({
  selector: 'app-library',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './library.component.html',
  styleUrls: ['./library.component.css']
})
export class LibraryComponent {
  @Output() topicSelected = new EventEmitter<string>();

  searchQuery: string = '';
  selectedCategory: string = 'All';

  categories: string[] = ['All', 'Biology', 'Physics', 'Chemistry', 'Maths', 'History'];

  libraryItems: LibraryItem[] = [
    {
      title: 'Photosynthesis',
      category: 'Biology',
      grade: 'Class 10',
      description: 'Explore light-dependent reactions, the stroma matrix, and the Calvin cycle in plant chloroplasts.',
      lessonsCount: 6,
      duration: '45 mins',
      progress: 60
    },
    {
      title: 'Cellular Respiration',
      category: 'Biology',
      grade: 'Class 10',
      description: 'Master Glycolysis, the Krebs cycle, and the Electron Transport Chain in mitochondria.',
      lessonsCount: 8,
      duration: '1 hr',
      progress: 100
    },
    {
      title: 'Quantum Physics',
      category: 'Physics',
      grade: 'Class 12',
      description: 'Understand wave-particle duality, superposition, quantum entanglement, and qubits.',
      lessonsCount: 12,
      duration: '2.5 hrs',
      progress: 20
    },
    {
      title: 'Organic Chemistry',
      category: 'Chemistry',
      grade: 'Class 11',
      description: 'Learn the properties, structures, and chemical reactions of carbon-containing covalent substances.',
      lessonsCount: 10,
      duration: '2 hrs',
      progress: 0
    },
    {
      title: 'Calculus Basics',
      category: 'Maths',
      grade: 'Class 12',
      description: 'Develop fundamental rules for derivatives, limits, and integral areas under curves.',
      lessonsCount: 14,
      duration: '3 hrs',
      progress: 10
    },
    {
      title: 'French Revolution',
      category: 'History',
      grade: 'Class 9',
      description: 'Trace the societal upheavals, structural collapses, and political reforms of 1789 France.',
      lessonsCount: 5,
      duration: '50 mins',
      progress: 0
    }
  ];

  getFilteredItems(): LibraryItem[] {
    return this.libraryItems.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
                            item.description.toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchesCategory = this.selectedCategory === 'All' || item.category === this.selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }

  selectCategory(category: string) {
    this.selectedCategory = category;
  }

  launchWorkspace(topic: string) {
    this.topicSelected.emit(topic);
  }
}

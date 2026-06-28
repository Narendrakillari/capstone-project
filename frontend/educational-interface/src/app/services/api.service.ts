import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs'; // Ensures standard reactive streams
import { catchError } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  // 🔽 Change this from 8080 to 8000 to match your new Uvicorn terminal!
  private baseUrl = 'http://127.0.0.1:8000/api';

  constructor(private http: HttpClient) {}

  generateWorkspace(prompt: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/generate-workspace`, { prompt });
  }


  generateQuiz(topic: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/generate-quiz`, { topic });
  }

  askQuestion(topic: string, videoUrl: string, videoSummary: string, question: string): Observable<any> {
    const encryptedTopic = btoa(unescape(encodeURIComponent(topic || '')));
    const encryptedVideoUrl = btoa(unescape(encodeURIComponent(videoUrl || '')));
    const encryptedVideoSummary = btoa(unescape(encodeURIComponent(videoSummary || '')));
    return this.http.post(`${this.baseUrl}/ask-question`, {
      topic: encryptedTopic,
      videoUrl: encryptedVideoUrl,
      videoSummary: encryptedVideoSummary,
      question: question
    });
  }

  saveQuizScore(username: string, topic: string, score: number, correctCount: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/save-quiz-score`, {
      username,
      topic,
      score,
      correct_count: correctCount
    });
  }

  getUserStats(username: string): Observable<any> {
    return this.http.get(`${this.baseUrl}/user-stats`, {
      params: { username }
    });
  }

  // 🌟 SECURE SERVICE HANDLER MATRIX
  login(username: string, password: string): Observable<any> {
    return this.http.post(`${this.baseUrl}/auth/login`, { username, password });
  }

  isTokenValid(token: string | null): boolean {
    if (!token) return false;
    try {
      const payloadBase64 = token.split('.')[1];
      const decodedPayload = JSON.parse(atob(payloadBase64));
      const expTimestamp = decodedPayload.exp * 1000;
      return expTimestamp > Date.now();
    } catch (e) {
      return false;
    }
  }
}
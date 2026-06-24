// src/deportes/football-api.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class FootballApiService {
  private readonly apiKey: string;
  private readonly apiUrl = 'https://v3.football.api-sports.io';

  constructor(private configService: ConfigService) {
    this.apiKey = this.configService.get<string>('FOOTBALL_API_KEY')!;
  }

  async fetchFixturesByDate(date: string): Promise<any[]> {
    try {
      const response = await axios.get(`${this.apiUrl}/fixtures`, {
        params: { date },
        headers: {
          'x-rapidapi-key': this.apiKey,
          'x-rapidapi-host': 'v3.football.api-sports.io',
        },
      });
      return response.data.response || [];
    } catch (error) {
      console.error(`Error fetching fixtures from API for date ${date}:`, error);
      return [];
    }
  }
}

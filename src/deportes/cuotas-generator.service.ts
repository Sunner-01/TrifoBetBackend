// src/deportes/cuotas-generator.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class CuotasGeneratorService {
  generarCuotasProfesionales(fixture: any) {
    const probLocal = 0.35 + Math.random() * 0.3;
    const probEmpate = 0.2 + Math.random() * 0.1;
    const probVisitante = 1 - probLocal - probEmpate;
    const margen = 1.06;

    const calc = (p: number) => {
      const c = 1 / (p * margen);
      return parseFloat((c < 1.01 ? 1.01 : c).toFixed(2));
    };

    const generarLinea = (baseProb: number, spread: number = 0.15) => {
      const pOver = Math.max(0.05, Math.min(0.95, baseProb + (Math.random() - 0.5) * spread));
      return { over: calc(pOver), under: calc(1 - pOver) };
    };

    const main = {
      '1X2': { '1': calc(probLocal), X: calc(probEmpate), '2': calc(probVisitante) },
      double_chance: {
        '1X': calc(probLocal + probEmpate),
        '12': calc(probLocal + probVisitante),
        X2: calc(probEmpate + probVisitante),
      },
      draw_no_bet: {
        '1': calc(probLocal / (probLocal + probVisitante)),
        '2': calc(probVisitante / (probLocal + probVisitante)),
      },
      btts: { yes: calc(0.55), no: calc(0.45) },
    };

    const goals = {
      total: {
        '0.5': generarLinea(0.92),
        '1.5': generarLinea(0.75),
        '2.5': generarLinea(0.5),
        '3.5': generarLinea(0.3),
        '4.5': generarLinea(0.15),
      },
      team_total_home: { '0.5': generarLinea(0.7), '1.5': generarLinea(0.4), '2.5': generarLinea(0.15) },
      team_total_away: { '0.5': generarLinea(0.6), '1.5': generarLinea(0.3), '2.5': generarLinea(0.1) },
      '1st_half': { '0.5': generarLinea(0.7), '1.5': generarLinea(0.35) },
      '2nd_half': { '0.5': generarLinea(0.75), '1.5': generarLinea(0.4) },
      odd_even: { odd: 1.9, even: 1.9 },
    };

    const asianLines = ['-1.5', '-1.0', '-0.5', '0.0', '+0.5', '+1.0', '+1.5'];
    const asianHandicap = {};
    asianLines.forEach((line) => {
      asianHandicap[line] = { '1': calc(0.5), '2': calc(0.5) };
    });

    const handicap = {
      european: {
        'home_-1': calc(probLocal * 0.4),
        'draw_-1': calc(probLocal * 0.25),
        'away_+1': calc(1 - probLocal * 0.65),
        'home_+1': calc(1 - probVisitante * 0.65),
        'draw_+1': calc(probVisitante * 0.25),
        'away_-1': calc(probVisitante * 0.4),
      },
      asian: asianHandicap,
    };

    const halves = {
      winner_1st: { '1': calc(probLocal * 0.9), X: calc(0.4), '2': calc(probVisitante * 0.9) },
      winner_2nd: { '1': calc(probLocal * 0.95), X: calc(0.38), '2': calc(probVisitante * 0.95) },
      both_halves_winner: { home: calc(probLocal * 0.2), away: calc(probVisitante * 0.2) },
      highest_scoring_half: { '1st': calc(0.3), '2nd': calc(0.5), equal: calc(0.2) },
    };

    const corners = {
      total: { '8.5': generarLinea(0.6), '9.5': generarLinea(0.5), '10.5': generarLinea(0.4) },
      home: { '4.5': generarLinea(0.5) },
      away: { '3.5': generarLinea(0.5) },
      handicap: { 'home_-1.5': 1.9, 'away_+1.5': 1.85 },
    };

    const cards = {
      total: { '3.5': generarLinea(0.6), '4.5': generarLinea(0.45), '5.5': generarLinea(0.3) },
      red_card: { yes: 4.5, no: 1.18 },
    };

    const specials = {
      to_win_to_nil: { home: calc(probLocal * 0.4), away: calc(probVisitante * 0.4) },
      clean_sheet: { home: calc(0.35), away: calc(0.25) },
      next_10_mins_goal: { yes: 4.5, no: 1.15 },
    };

    return { main, goals, handicap, halves, corners, cards, specials };
  }
}

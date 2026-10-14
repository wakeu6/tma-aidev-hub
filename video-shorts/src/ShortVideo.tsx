import React from 'react';
import { AbsoluteFill, Audio, Sequence, staticFile } from 'remotion';
import { Background } from './components/Background';
import { ProgressBar } from './components/ProgressBar';
import { Scene1Hook } from './scenes/Scene1Hook';
import { Scene2Prompt } from './scenes/Scene2Prompt';
import { Scene3Reveal } from './scenes/Scene3Reveal';
import { Scene4CTA } from './scenes/Scene4CTA';

export const ShortVideo: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: '#0A0A0C',
        color: '#FFFFFF',
        fontFamily:
          "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflow: 'hidden',
      }}
    >
      {/* Google Fonts import style */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,600;0,700;0,800;0,900;1,900&display=swap');
      `}</style>

      {/* Persistent Animated Background */}
      <Background />

      {/* Background Cyber Beat & Ambient rhythm (runs through the entire short) */}
      <Audio src={staticFile('bg_beat.wav')} volume={0.22} />

      {/* Scene 1: Frames 0..90 (0..3s) - НЕ ДУМАЙ ОБ ЭТОМ & 3..2..1 */}
      <Sequence durationInFrames={90} name="Scene1_Hook">
        <Scene1Hook />
        {/* Voiceover 1: «Не думай об этом. Три, два, один.» */}
        <Audio src={staticFile('voice_1.mp3')} volume={1} />
        {/* Synchronized HUD beeps on countdown numbers 3, 2, 1 */}
        <Sequence from={10} durationInFrames={15}>
          <Audio src={staticFile('countdown_beep.wav')} volume={0.5} />
        </Sequence>
        <Sequence from={36} durationInFrames={15}>
          <Audio src={staticFile('countdown_beep.wav')} volume={0.5} />
        </Sequence>
        <Sequence from={62} durationInFrames={15}>
          <Audio src={staticFile('countdown_beep.wav')} volume={0.5} />
        </Sequence>
      </Sequence>

      {/* Scene 2: Frames 90..210 (3..7s) - Назови любой фрукт и любой цвет */}
      <Sequence from={90} durationInFrames={120} name="Scene2_Prompt">
        <Scene2Prompt />
        {/* Transition whoosh */}
        <Sequence durationInFrames={20}>
          <Audio src={staticFile('whoosh.wav')} volume={0.3} />
        </Sequence>
        {/* Voiceover 2: «Назови любой фрукт и любой цвет прямо сейчас!» */}
        <Audio src={staticFile('voice_2.mp3')} volume={1} />
      </Sequence>

      {/* Scene 3: Frames 210..330 (7..11s) - Вспышка, Яблоко/Красный, 92% */}
      <Sequence from={210} durationInFrames={120} name="Scene3_Reveal">
        <Scene3Reveal />
        {/* Impact boom on screen flash */}
        <Sequence durationInFrames={30}>
          <Audio src={staticFile('impact.wav')} volume={0.65} />
        </Sequence>
        {/* Voiceover 3: «Ты ведь загадал яблоко или красный? Девяносто два процента людей называют именно их.» */}
        <Audio src={staticFile('voice_3.mp3')} volume={1} />
      </Sequence>

      {/* Scene 4: Frames 330..420 (11..14s) - CTA комменты & бесшовный переход */}
      <Sequence from={330} durationInFrames={90} name="Scene4_CTA">
        <Scene4CTA />
        {/* Transition whoosh */}
        <Sequence durationInFrames={20}>
          <Audio src={staticFile('whoosh.wav')} volume={0.3} />
        </Sequence>
        {/* Voiceover 4: «Я угадал? Напиши свой ответ в комментариях прямо сейчас!» */}
        <Audio src={staticFile('voice_4.mp3')} volume={1} />
      </Sequence>

      {/* Persistent Neon Bottom Progress Bar */}
      <ProgressBar totalFrames={420} />
    </AbsoluteFill>
  );
};

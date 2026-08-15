/**
 * Small procedural score and sound-design system for ORBITBREAK.
 *
 * Every voice is generated with the Web Audio API after the first player gesture, so the
 * jam build ships no external audio files and remains safe under browser autoplay rules.
 */
export class WorldseedAudio {
  constructor() {
    this.context = null;
    this.masterGain = null;
    this.musicLayerGains = [];
    this.transientSources = new Set();
    this.aimVoice = null;
    this.flightVoice = null;
    this.noiseBuffer = null;
    this.isMuted = false;
    this.wasLandingLocked = false;
    this.closePassPlayed = false;
    this.lifeLayerGains = null;
  }

  /** Creates the graph lazily inside a trusted pointer or button gesture. */
  ensureStarted() {
    if (this.context) {
      if (this.context.state === 'suspended') {
        this.context.resume();
      }
      return true;
    }

    const AudioContextConstructor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextConstructor) {
      return false;
    }

    this.context = new AudioContextConstructor();
    this.masterGain = this.context.createGain();
    this.masterGain.gain.value = this.isMuted ? 0 : 0.7;
    const Compressor = this.context.createDynamicsCompressor();
    Compressor.threshold.value = -18;
    Compressor.knee.value = 12;
    Compressor.ratio.value = 5;
    Compressor.attack.value = 0.006;
    Compressor.release.value = 0.22;
    this.masterGain.connect(Compressor).connect(this.context.destination);

    this.createNoiseBuffer();
    this.createMusicBed();
    return true;
  }

  createNoiseBuffer() {
    const FrameCount = Math.ceil(this.context.sampleRate * 0.42);
    this.noiseBuffer = this.context.createBuffer(1, FrameCount, this.context.sampleRate);
    const Samples = this.noiseBuffer.getChannelData(0);
    let NoiseValue = 0;
    for (let SampleIndex = 0; SampleIndex < Samples.length; SampleIndex += 1) {
      NoiseValue = (NoiseValue * 0.78) + (((Math.random() * 2) - 1) * 0.22);
      Samples[SampleIndex] = NoiseValue;
    }
  }

  /** Starts three near-silent sustained layers that fade in as worlds awaken. */
  createMusicBed() {
    const LayerDefinitions = [
      { frequency: 55, type: 'sine', volume: 0.022 },
      { frequency: 82.5, type: 'triangle', volume: 0.018 },
      { frequency: 110, type: 'sine', volume: 0.014 },
    ];

    for (const LayerDefinition of LayerDefinitions) {
      const Oscillator = this.context.createOscillator();
      const Gain = this.context.createGain();
      Oscillator.type = LayerDefinition.type;
      Oscillator.frequency.value = LayerDefinition.frequency;
      Gain.gain.value = 0;
      Oscillator.connect(Gain).connect(this.masterGain);
      Oscillator.start();
      this.musicLayerGains.push({ gain: Gain, volume: LayerDefinition.volume });
    }
    this.createLifeBeds();
    this.setRestoredWorldCount(0);
  }

  createLifeBeds() {
    const LifeLayerDefinitions = [
      { key: 'rumble', frequency: 38, type: 'sawtooth', volume: 0.028 },
      { key: 'garden', frequency: 196, type: 'sine', volume: 0.016 },
      { key: 'dock', frequency: 262, type: 'triangle', volume: 0.02 },
    ];
    this.lifeLayerGains = {};
    for (const LayerDefinition of LifeLayerDefinitions) {
      const Oscillator = this.context.createOscillator();
      const Gain = this.context.createGain();
      Oscillator.type = LayerDefinition.type;
      Oscillator.frequency.value = LayerDefinition.frequency;
      Gain.gain.value = 0;
      Oscillator.connect(Gain).connect(this.masterGain);
      Oscillator.start();
      this.lifeLayerGains[LayerDefinition.key] = {
        gain: Gain,
        volume: LayerDefinition.volume,
      };
    }
  }

  setWorldLifeMix(Mix) {
    if (!this.context || !this.lifeLayerGains) {
      return;
    }
    const Now = this.context.currentTime;
    const SafeMix = Mix ?? { rumble: 0, garden: 0, dock: 0 };
    for (const [LayerKey, LayerStrength] of [
      ['rumble', SafeMix.rumble],
      ['garden', SafeMix.garden],
      ['dock', SafeMix.dock],
    ]) {
      const LifeLayer = this.lifeLayerGains[LayerKey];
      if (!LifeLayer || !Number.isFinite(LayerStrength)) continue;
      LifeLayer.gain.gain.cancelScheduledValues(Now);
      LifeLayer.gain.gain.setTargetAtTime(
        LifeLayer.volume * Math.max(0, Math.min(1, LayerStrength)),
        Now,
        0.7,
      );
    }
  }

  tradeLane() {
    this.playTone({
      frequency: 520,
      endFrequency: 780,
      duration: 0.22,
      volume: 0.05,
      type: 'triangle',
    });
    this.playTone({
      frequency: 780,
      endFrequency: 1040,
      duration: 0.18,
      volume: 0.03,
      delay: 0.08,
    });
  }

  haulLane() {
    this.playNoise({ duration: 0.32, volume: 0.08, frequency: 140 });
    this.playTone({
      frequency: 64,
      endFrequency: 48,
      duration: 0.36,
      volume: 0.07,
      type: 'sawtooth',
    });
  }

  setRestoredWorldCount(RestoredWorldCount) {
    if (!this.context) {
      return;
    }
    const Now = this.context.currentTime;
    this.musicLayerGains.forEach((MusicLayer, LayerIndex) => {
      const IsLayerActive = LayerIndex <= RestoredWorldCount;
      MusicLayer.gain.gain.cancelScheduledValues(Now);
      MusicLayer.gain.gain.setTargetAtTime(
        IsLayerActive ? MusicLayer.volume : 0,
        Now,
        0.8,
      );
    });
  }

  /** Plays a short shaped oscillator voice. */
  playTone({
    frequency,
    endFrequency = frequency,
    duration = 0.16,
    volume = 0.08,
    type = 'sine',
    delay = 0,
  }) {
    if (!this.ensureStarted()) {
      return;
    }
    const StartTime = this.context.currentTime + delay;
    const EndTime = StartTime + duration;
    const Oscillator = this.context.createOscillator();
    const Gain = this.context.createGain();
    Oscillator.type = type;
    Oscillator.frequency.setValueAtTime(Math.max(1, frequency), StartTime);
    Oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), EndTime);
    Gain.gain.setValueAtTime(0.0001, StartTime);
    Gain.gain.exponentialRampToValueAtTime(volume, StartTime + Math.min(0.025, duration * 0.25));
    Gain.gain.exponentialRampToValueAtTime(0.0001, EndTime);
    Oscillator.connect(Gain).connect(this.masterGain);
    this.transientSources.add(Oscillator);
    Oscillator.addEventListener('ended', () => this.transientSources.delete(Oscillator), {
      once: true,
    });
    Oscillator.start(StartTime);
    Oscillator.stop(EndTime + 0.03);
  }

  /** Plays a filtered noise transient for release, impact and recovery texture. */
  playNoise({ duration = 0.18, volume = 0.08, frequency = 1000, delay = 0 }) {
    if (!this.ensureStarted()) {
      return;
    }
    const StartTime = this.context.currentTime + delay;
    const Source = this.context.createBufferSource();
    const Filter = this.context.createBiquadFilter();
    const Gain = this.context.createGain();
    Source.buffer = this.noiseBuffer;
    Filter.type = 'bandpass';
    Filter.frequency.value = frequency;
    Filter.Q.value = 0.7;
    Gain.gain.setValueAtTime(volume, StartTime);
    Gain.gain.exponentialRampToValueAtTime(0.0001, StartTime + duration);
    Source.connect(Filter).connect(Gain).connect(this.masterGain);
    this.transientSources.add(Source);
    Source.addEventListener('ended', () => this.transientSources.delete(Source), { once: true });
    Source.start(StartTime);
    Source.stop(StartTime + duration + 0.02);
  }

  beginAim() {
    if (!this.ensureStarted() || this.aimVoice) {
      return;
    }
    const Oscillator = this.context.createOscillator();
    const Gain = this.context.createGain();
    Oscillator.type = 'sine';
    Oscillator.frequency.value = 170;
    Gain.gain.value = 0.0001;
    Oscillator.connect(Gain).connect(this.masterGain);
    Oscillator.start();
    Gain.gain.setTargetAtTime(0.025, this.context.currentTime, 0.025);
    this.aimVoice = { oscillator: Oscillator, gain: Gain };
    this.wasLandingLocked = false;
    this.playTone({ frequency: 330, endFrequency: 440, duration: 0.08, volume: 0.045 });
  }

  updateAim(PowerRatio, IsLandingLocked) {
    if (!this.aimVoice) {
      return;
    }
    const Now = this.context.currentTime;
    this.aimVoice.oscillator.frequency.setTargetAtTime(165 + (PowerRatio * 310), Now, 0.035);
    this.aimVoice.gain.gain.setTargetAtTime(0.014 + (PowerRatio * 0.025), Now, 0.035);
    if (IsLandingLocked && !this.wasLandingLocked) {
      this.playTone({ frequency: 660, endFrequency: 880, duration: 0.11, volume: 0.07 });
    }
    this.wasLandingLocked = IsLandingLocked;
  }

  endAim() {
    if (!this.aimVoice) {
      return;
    }
    const Voice = this.aimVoice;
    const Now = this.context.currentTime;
    Voice.gain.gain.cancelScheduledValues(Now);
    Voice.gain.gain.setTargetAtTime(0.0001, Now, 0.025);
    Voice.oscillator.stop(Now + 0.14);
    this.aimVoice = null;
  }

  launch(PowerRatio) {
    this.endAim();
    this.playNoise({ duration: 0.2, volume: 0.09 + (PowerRatio * 0.05), frequency: 1500 });
    this.playTone({
      frequency: 150 + (PowerRatio * 70),
      endFrequency: 520 + (PowerRatio * 260),
      duration: 0.22,
      volume: 0.105,
      type: 'triangle',
    });
    this.startFlightVoice();
    this.closePassPlayed = false;
  }

  startFlightVoice() {
    if (!this.ensureStarted() || this.flightVoice) {
      return;
    }
    const Oscillator = this.context.createOscillator();
    const Filter = this.context.createBiquadFilter();
    const Gain = this.context.createGain();
    Oscillator.type = 'sawtooth';
    Oscillator.frequency.value = 82;
    Filter.type = 'lowpass';
    Filter.frequency.value = 460;
    Gain.gain.value = 0.0001;
    Oscillator.connect(Filter).connect(Gain).connect(this.masterGain);
    Oscillator.start();
    this.flightVoice = { oscillator: Oscillator, filter: Filter, gain: Gain };
  }

  updateFlight(Speed, NearestSurfaceDistance) {
    if (!this.flightVoice) {
      return;
    }
    const Now = this.context.currentTime;
    const SpeedRatio = Math.min(1, Speed / 18);
    const ProximityRatio = Math.max(0, Math.min(1, 1 - (NearestSurfaceDistance / 3)));
    this.flightVoice.oscillator.frequency.setTargetAtTime(78 + (SpeedRatio * 95), Now, 0.06);
    this.flightVoice.filter.frequency.setTargetAtTime(350 + (SpeedRatio * 900), Now, 0.08);
    this.flightVoice.gain.gain.setTargetAtTime(
      0.008 + (SpeedRatio * 0.022) + (ProximityRatio * 0.018),
      Now,
      0.06,
    );

    if (!this.closePassPlayed && NearestSurfaceDistance < 1.5) {
      this.closePassPlayed = true;
      this.playTone({ frequency: 420, endFrequency: 760, duration: 0.18, volume: 0.055 });
    }
  }

  endFlight() {
    if (!this.flightVoice) {
      return;
    }
    const Voice = this.flightVoice;
    const Now = this.context.currentTime;
    Voice.gain.gain.cancelScheduledValues(Now);
    Voice.gain.gain.setTargetAtTime(0.0001, Now, 0.035);
    Voice.oscillator.stop(Now + 0.18);
    this.flightVoice = null;
  }

  impact(WorldIdentifier) {
    this.endFlight();
    const ImpactPitch = WorldIdentifier === 'ember' ? 92 : WorldIdentifier === 'frost' ? 132 : 110;
    this.playNoise({ duration: 0.24, volume: 0.14, frequency: 520 });
    this.playTone({ frequency: ImpactPitch, endFrequency: ImpactPitch * 0.66, duration: 0.28, volume: 0.14, type: 'triangle' });
    this.playTone({ frequency: ImpactPitch * 4, endFrequency: ImpactPitch * 5, duration: 0.24, volume: 0.065, delay: 0.035 });
  }

  restore(WorldIdentifier, RestoredWorldCount) {
    const RootFrequency = WorldIdentifier === 'ember' ? 220 : 277.18;
    this.playNoise({ duration: 0.34, volume: 0.11, frequency: 1900 });
    this.playTone({
      frequency: 96,
      endFrequency: RootFrequency * 1.5,
      duration: 0.48,
      volume: 0.085,
      type: 'sawtooth',
    });
    const Ratios = [1, 1.25, 1.5, 2, 2.5];
    Ratios.forEach((Ratio, NoteIndex) => {
      this.playTone({
        frequency: RootFrequency * Ratio,
        endFrequency: RootFrequency * Ratio * 1.04,
        duration: 0.52,
        volume: 0.055,
        type: NoteIndex % 2 === 0 ? 'sine' : 'triangle',
        delay: NoteIndex * 0.24,
      });
    });
    this.setRestoredWorldCount(RestoredWorldCount);
  }

  briefingVoice(Speaker) {
    const Voices = {
      'THE WARDEN': { root: 68, type: 'sawtooth', noise: 140, volume: 0.1 },
      'THE RUNNER': { root: 233, type: 'triangle', noise: 980, volume: 0.07 },
      HAVEN: { root: 196, type: 'sine', noise: 1500, volume: 0.055 },
      'THE RUN': { root: 311, type: 'triangle', noise: 640, volume: 0.07 },
    };
    const Voice = Voices[Speaker] ?? Voices['THE RUNNER'];
    this.playNoise({ duration: 0.22, volume: Voice.volume * 0.7, frequency: Voice.noise });
    [1, 1.25, 1.5, 0.75].forEach((Ratio, NoteIndex) => {
      this.playTone({
        frequency: Voice.root * Ratio,
        endFrequency: Voice.root * Ratio * (NoteIndex === 3 ? 0.92 : 1.03),
        duration: 0.28,
        volume: Voice.volume,
        type: Voice.type,
        delay: NoteIndex * 0.09,
      });
    });
  }

  slingshot(TierLabel, ChainMultiplier) {
    const TierOffset = TierLabel.startsWith('RAZOR')
      ? 1.34
      : TierLabel.startsWith('DEEP') ? 1.17 : 1;
    const ChainOffset = Math.min(1.28, 1 + ((ChainMultiplier - 1) * 0.08));
    const RootFrequency = 390 * TierOffset * ChainOffset;
    this.playTone({
      frequency: RootFrequency,
      endFrequency: RootFrequency * 1.65,
      duration: 0.2,
      volume: 0.065,
      type: 'triangle',
    });
    if (ChainMultiplier > 1) {
      this.playTone({
        frequency: RootFrequency * 1.5,
        endFrequency: RootFrequency * 2,
        duration: 0.24,
        volume: 0.045,
        delay: 0.055,
      });
    }
  }

  restorationComplete(WorldIdentifier) {
    const RootFrequency = WorldIdentifier === 'ember' ? 329.63 : 440;
    [1, 1.25, 1.5].forEach((Ratio, NoteIndex) => {
      this.playTone({
        frequency: RootFrequency * Ratio,
        duration: 0.42,
        volume: 0.055,
        delay: NoteIndex * 0.055,
      });
    });
  }

  stardust(CollectedCount, TotalCount) {
    const IsArcComplete = CollectedCount === TotalCount;
    const RootFrequency = 660 * Math.pow(2, (CollectedCount - 1) / 12);
    this.playTone({
      frequency: RootFrequency,
      endFrequency: RootFrequency * 1.35,
      duration: IsArcComplete ? 0.38 : 0.2,
      volume: 0.052,
      type: 'sine',
    });
    if (IsArcComplete) {
      this.playTone({
        frequency: RootFrequency * 1.5,
        endFrequency: RootFrequency * 2,
        duration: 0.48,
        volume: 0.045,
        type: 'triangle',
        delay: 0.08,
      });
    }
  }

  worldheartOpen() {
    [329.63, 440, 554.37].forEach((Frequency, NoteIndex) => {
      this.playTone({
        frequency: Frequency,
        endFrequency: Frequency * 1.04,
        duration: 0.62,
        volume: 0.055,
        type: NoteIndex === 1 ? 'triangle' : 'sine',
        delay: NoteIndex * 0.11,
      });
    });
  }

  failure() {
    this.endAim();
    this.endFlight();
    this.playNoise({ duration: 0.28, volume: 0.055, frequency: 260 });
    this.playTone({ frequency: 240, endFrequency: 72, duration: 0.42, volume: 0.09, type: 'triangle' });
  }

  victory() {
    const ChordFrequencies = [220, 277.18, 329.63, 440, 554.37];
    ChordFrequencies.forEach((Frequency, NoteIndex) => {
      this.playTone({
        frequency: Frequency,
        endFrequency: Frequency * 1.01,
        duration: 1.45,
        volume: 0.065,
        delay: NoteIndex * 0.07,
        type: NoteIndex % 2 === 0 ? 'sine' : 'triangle',
      });
    });
  }

  reset() {
    this.endAim();
    this.endFlight();
    for (const TransientSource of this.transientSources) {
      try {
        TransientSource.stop();
      } catch {
        // A source can finish between iteration and stop; it will be removed by `ended`.
      }
    }
    this.transientSources.clear();
    this.setRestoredWorldCount(0);
    this.setWorldLifeMix({ rumble: 0, garden: 0, dock: 0 });
    this.closePassPlayed = false;
    this.wasLandingLocked = false;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.ensureStarted()) {
      this.masterGain.gain.setTargetAtTime(
        this.isMuted ? 0 : 0.7,
        this.context.currentTime,
        0.025,
      );
    }
    return this.isMuted;
  }

  /** Suspends background audio and resumes only an already-authorized context. */
  setPageActive(IsPageActive) {
    if (!this.context) {
      return;
    }
    const ContextOperation = IsPageActive ? this.context.resume() : this.context.suspend();
    ContextOperation.catch(() => {
      // Mobile lifecycle audio can settle asynchronously; the next gesture retries it.
    });
  }
}

"""Narration for a storyboard: one Kokoro clip per step, the timing plan, and the narration track.

The plan is fixed before anything is recorded: each step lasts max(min_seconds, narration + gap), rounded up to
0.1 s, and the recorder waits for each planned start. So the same storyboard always gives the same narration
track, byte for byte.

    python3 tts.py <storyboard.json> <work dir>
"""
import hashlib
import json
import math
import os
import sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

LEAD, GAP, TAIL, RATE = 1.0, 0.6, 1.5, 24000
KINDS = ('card', 'file', 'app')


def fail(message):
    sys.exit(f'storyboard: {message}')


def validate(story):
    steps = story.get('steps')
    if not isinstance(steps, list) or not steps:
        fail('"steps" must be a non-empty list')
    for number, step in enumerate(steps, 1):
        if not isinstance(step.get('say'), str) or not step['say'].strip():
            fail(f'step {number} needs "say", the narration')
        kinds = [kind for kind in KINDS if kind in step]
        if len(kinds) != 1:
            fail(f'step {number} needs exactly one of {", ".join(KINDS)}')
        if 'card' in step and not isinstance(step['card'], dict):
            fail(f'step {number}: "card" is an object with "title", and "lines" or "stats"')
        if 'app' in step and not isinstance(step['app'], list):
            fail(f'step {number}: "app" is a list of actions')


def main():
    story_path, work = sys.argv[1], sys.argv[2]
    with open(story_path) as handle:
        story = json.load(handle)
    validate(story)
    os.makedirs(os.path.join(work, 'clips'), exist_ok=True)
    voice = story.get('voice', 'af_heart')
    speed = float(story.get('speed', 1.0))
    lang = story.get('lang', 'en-us')
    kokoro = Kokoro('/opt/models/kokoro/kokoro-v1.0.onnx', '/opt/models/kokoro/voices-v1.0.bin')

    at, steps, clips = LEAD, [], []
    for index, step in enumerate(story['steps']):
        samples, rate = kokoro.create(step['say'].strip(), voice=voice, speed=speed, lang=lang)
        if rate != RATE:
            fail(f'unexpected sample rate {rate}')
        samples = np.asarray(samples, dtype=np.float32)
        spoken = len(samples) / RATE
        duration = math.ceil(max(float(step.get('min_seconds', 0)), spoken + GAP) * 10) / 10
        clip = os.path.join(work, 'clips', f'{index:02d}.wav')
        sf.write(clip, samples, RATE, subtype='PCM_16')
        steps.append({**step, 'index': index, 'start': round(at, 1), 'duration': duration,
                      'spoken': round(spoken, 3)})
        clips.append((round(at, 1), samples))
        at += duration
    total = round(at + TAIL, 1)

    track = np.zeros(int(round(total * RATE)), dtype=np.float32)
    for start, samples in clips:
        first = int(round(start * RATE))
        track[first:first + len(samples)] += samples
    np.clip(track, -1.0, 1.0, out=track)
    narration = os.path.join(work, 'narration.wav')
    sf.write(narration, track, RATE, subtype='PCM_16')
    with open(narration, 'rb') as handle:
        digest = hashlib.sha256(handle.read()).hexdigest()

    plan = {
        'title': story.get('title', 'Proof video'), 'name': story.get('name'), 'module': story.get('module'),
        'voice': voice, 'speed': speed, 'total': total, 'steps': steps,
        'needs_app': any('app' in step for step in steps), 'narration_sha256': digest,
    }
    with open(os.path.join(work, 'plan.json'), 'w') as handle:
        json.dump(plan, handle, indent=1)
    print(f'narration: {len(steps)} steps, {total:.1f} s, sha256 {digest}')


if __name__ == '__main__':
    main()

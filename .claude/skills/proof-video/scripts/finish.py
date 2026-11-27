"""Mux, caption, check and summarize a recorded storyboard.

    python3 finish.py <work dir> <out dir>

Writes proof.mp4 (captions burned in), captions.srt, transcript.json, contact-sheet.png, run-info.json and
checks.txt to the out dir. Exits 1 if a check fails: video or audio missing, or the transcript differs from the
narration by more than 10% of its words.
"""
import json
import math
import os
import re
import shutil
import subprocess
import sys

import soundfile as sf
from faster_whisper import WhisperModel

MAX_WER = 0.10


def run(*command):
    subprocess.run(command, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def words(text):
    text = text.lower().replace('’', "'")
    text = re.sub(r'(?<=\d),(?=\d{3})', '', text)  # 1,502 -> 1502
    text = re.sub(r"[^a-z0-9.' ]+", ' ', text)
    text = re.sub(r'(?<!\d)\.|\.(?!\d)', ' ', text)  # keep 1.5, drop sentence dots
    return [word.strip("'") for word in text.split() if word.strip("'")]


def wer(reference, hypothesis):
    ref, hyp = words(reference), words(hypothesis)
    if not ref:
        return 0.0, []
    previous = list(range(len(hyp) + 1))
    for i, ref_word in enumerate(ref, 1):
        current = [i] + [0] * len(hyp)
        for j, hyp_word in enumerate(hyp, 1):
            current[j] = min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (ref_word != hyp_word))
        previous = current
    missing = sorted(set(ref) - set(hyp))
    return previous[-1] / len(ref), missing


def stamp(seconds):
    millis = int(round(seconds * 1000))
    hours, millis = divmod(millis, 3600000)
    minutes, millis = divmod(millis, 60000)
    secs, millis = divmod(millis, 1000)
    return f'{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}'


def main():
    work, out = sys.argv[1], sys.argv[2]
    with open(os.path.join(work, 'plan.json')) as handle:
        plan = json.load(handle)
    total = plan['total']
    raw = os.path.join(work, 'raw.mp4')
    run('ffmpeg', '-y', '-i', os.path.join(work, 'video.webm'), '-i', os.path.join(work, 'narration.wav'),
        '-map', '0:v:0', '-map', '1:a:0', '-t', str(total), '-r', '30', '-c:v', 'libx264', '-preset', 'medium',
        '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', raw)

    # Whisper wants 16 kHz mono samples. ffmpeg decodes them, so PyAV's API changes don't matter.
    speech = os.path.join(work, 'speech-16k.wav')
    run('ffmpeg', '-y', '-i', os.path.join(work, 'narration.wav'), '-ac', '1', '-ar', '16000', speech)
    samples, _ = sf.read(speech, dtype='float32')
    model = WhisperModel('/opt/models/whisper-base.en', device='cpu', compute_type='int8')
    segments, _ = model.transcribe(samples, language='en', beam_size=5)
    segments = [{'start': round(s.start, 2), 'end': round(s.end, 2), 'text': s.text.strip()} for s in segments]
    with open(os.path.join(out, 'transcript.json'), 'w') as handle:
        json.dump(segments, handle, indent=1)
    srt = os.path.join(out, 'captions.srt')
    with open(srt, 'w') as handle:
        for number, segment in enumerate(segments, 1):
            handle.write(f'{number}\n{stamp(segment["start"])} --> {stamp(segment["end"])}\n{segment["text"]}\n\n')

    heard = ' '.join(segment['text'] for segment in segments)
    said = ' '.join(step['say'] for step in plan['steps'])
    overall, missing = wer(said, heard)
    per_step = []
    for step in plan['steps']:
        low, high = step['start'], step['start'] + step['duration']
        in_step = ' '.join(s['text'] for s in segments if low <= (s['start'] + s['end']) / 2 < high)
        per_step.append(round(wer(step['say'], in_step)[0], 3))

    proof = os.path.join(out, 'proof.mp4')
    style = ('FontName=Liberation Sans,FontSize=16,PrimaryColour=&H00FFFFFF,BackColour=&H99000000,'
             'BorderStyle=4,Outline=0,Shadow=0,MarginV=24')
    run('ffmpeg', '-y', '-i', raw, '-vf', f"subtitles={srt}:force_style='{style}'", '-c:v', 'libx264',
        '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', proof)

    frames = os.path.join(work, 'frames')
    os.makedirs(frames, exist_ok=True)
    count = len(plan['steps'])
    columns = min(3, count)
    rows = math.ceil(count / columns)
    for step in plan['steps']:
        middle = step['start'] + step['duration'] / 2
        run('ffmpeg', '-y', '-ss', f'{middle:.2f}', '-i', proof, '-frames:v', '1', '-vf', 'scale=640:-2',
            os.path.join(frames, f'{step["index"]:02d}.png'))
    for blank in range(count, rows * columns):
        run('ffmpeg', '-y', '-f', 'lavfi', '-i', 'color=c=0x1e2d24:s=640x400', '-frames:v', '1',
            os.path.join(frames, f'{blank:02d}.png'))
    run('ffmpeg', '-y', '-framerate', '1', '-i', os.path.join(frames, '%02d.png'), '-vf',
        f'tile={columns}x{rows}:padding=8:margin=8:color=0x1e2d24', '-frames:v', '1',
        os.path.join(out, 'contact-sheet.png'))

    probe = json.loads(subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,codec_name,width,height,sample_rate',
         '-show_entries', 'format=duration', '-of', 'json', proof], check=True, capture_output=True).stdout)
    kinds = {stream['codec_type'] for stream in probe['streams']}
    with open(os.path.join(work, 'timings.json')) as handle:
        timings = json.load(handle)

    info = {
        'title': plan['title'], 'name': plan['name'], 'date': os.environ.get('PV_DATE'),
        'git': {'sha': os.environ.get('PV_GIT_SHA'), 'branch': os.environ.get('PV_GIT_BRANCH'),
                'pr': os.environ.get('PV_PR') or None, 'dirty': os.environ.get('PV_GIT_DIRTY') == '1'},
        'voice': plan['voice'], 'speed': plan['speed'], 'duration': total,
        'narration_sha256': plan['narration_sha256'],
        'models': {'kokoro': 'kokoro-v1.0.onnx sha256 7d5df8ec…', 'whisper': 'Systran/faster-whisper-base.en@3d3d5dee'},
        'word_error_rate': round(overall, 3), 'word_error_rate_per_step': per_step, 'words_not_heard': missing,
        'steps': [{'start': s['start'], 'duration': s['duration'], 'say': s['say'],
                   'shows': 'card' if 'card' in s else 'file' if 'file' in s else 'app'} for s in plan['steps']],
        'timings': timings, 'ffprobe': probe,
    }
    with open(os.path.join(out, 'run-info.json'), 'w') as handle:
        json.dump(info, handle, indent=1)

    checks = [
        ('video and audio streams', kinds >= {'video', 'audio'}, ', '.join(sorted(kinds))),
        ('duration', abs(float(probe['format']['duration']) - total) < 1.0,
         f'{float(probe["format"]["duration"]):.1f} s, planned {total} s'),
        ('transcript matches narration', overall <= MAX_WER,
         f'word error rate {overall:.1%} (max {MAX_WER:.0%})' + (f'; not heard: {", ".join(missing[:12])}' if missing else '')),
    ]
    lines = [f'{"PASS" if ok else "FAIL"}  {name}: {detail}' for name, ok, detail in checks]
    lines.append(f'narration sha256 {plan["narration_sha256"]}')
    lines.append('Now look at contact-sheet.png: one frame from the middle of each step, in order, against the narration.')
    with open(os.path.join(out, 'checks.txt'), 'w') as handle:
        handle.write('\n'.join(lines) + '\n')
    print('\n'.join(lines))
    if not all(ok for _, ok, _ in checks):
        sys.exit(1)
    shutil.rmtree(work, ignore_errors=True)


if __name__ == '__main__':
    main()

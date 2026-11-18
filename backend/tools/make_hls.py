"""Convert a video file to HLS (adaptive-friendly .m3u8 + .ts segments) with FFmpeg.

    python tools/make_hls.py path/to/episode.mp4 my-show-s1e1

Output goes to backend/media/<name>/index.m3u8, which Flask serves at
    /media/<name>/index.m3u8
Use that URL as video_url when you add a movie or episode. Requires FFmpeg on your PATH.

Subtitles: convert .srt to WebVTT with
    ffmpeg -i subs.srt subs.vtt
put the .vtt in backend/media/ and set subtitle_url to /media/subs.vtt
"""
import os
import subprocess
import sys

if len(sys.argv) != 3:
    sys.exit(__doc__)

src, name = sys.argv[1], sys.argv[2]
out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "media", name)
os.makedirs(out, exist_ok=True)
cmd = [
    "ffmpeg", "-y", "-i", src,
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "128k",
    "-hls_time", "6", "-hls_playlist_type", "vod",
    "-hls_segment_filename", os.path.join(out, "seg_%04d.ts"),
    os.path.join(out, "index.m3u8"),
]
print("Running:", " ".join(cmd))
subprocess.run(cmd, check=True)
print(f"\nDone. Use this as video_url:  /media/{name}/index.m3u8")

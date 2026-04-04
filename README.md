# 🚀 AI Video Upscaler Pipeline

A high-performance automated pipeline for **video upscaling** (ideal for anime and animation) using **Real-ESRGAN** and **FFmpeg**.

Built with **TypeScript** and powered by **Bun** 🥟 (a fast alternative to Node.js).

---

## ⚙️ Requirements

Before running the project, ensure you have the following installed:

1. **[Bun](https://bun.sh/)** – Main runtime.
2. **[FFmpeg](https://ffmpeg.org/download.html)** – Required for video and audio processing.
   Ensure both `ffmpeg` and `ffprobe` are available in your system `PATH`.
3. **[Real-ESRGAN](https://github.com/xinntao/Real-ESRGAN/releases)** – The AI model is not bundled.
   Download the CLI version (e.g., `realesrgan-ncnn-vulkan`).

---

## 🛠️ Installation

### 1. Clone the repository and install dependencies

```bash
git clone https://github.com/diego-dini/AI-Video-Upscaler-Pipeline
cd AI-Video-Upscaler-Pipeline
bun install
```

### 2. Create the input directory

The `inputs` folder is not included in the repository and must be created manually:

```bash
mkdir inputs
```

> The `outputs` directory will be created automatically during execution.

### 3. Configure Real-ESRGAN

Set the path to the Real-ESRGAN executable using a `.env` file:

```env
VERBOSE="true"
```

---

## 🚀 Usage

1. Place your video files (`.mp4` or `.mkv`) inside the `inputs/` directory.
2. Run the pipeline:

```bash
bun run dev
```

3. Monitor progress in the terminal. The CLI displays:
   - Progress percentage
   - FPS (processing speed)
   - Estimated time remaining (ETA)

4. The final upscaled videos will be available in the `outputs/` directory.

---

## 🧠 Pipeline Overview

The system orchestrates a full processing pipeline to ensure quality and synchronization:

- **1. Scanner (`getEpisodes`)**
  Reads the `inputs/` directory and extracts metadata (framerate, duration, frame count) using `ffprobe`.

- **2. Frame Extraction (`extractFrames`)**
  Uses FFmpeg (with optional hardware acceleration) to extract video frames.

- **3. Audio Extraction (`extractAudio`)**
  Extracts the original audio stream without re-encoding.

- **4. Upscaling (`upscaleFrames`)**
  Processes each frame using Real-ESRGAN to increase resolution and reduce artifacts.

- **5. Encoding (`encodeEpisode`)**
  Reconstructs the video using the upscaled frames and original audio.

- **6. Cleanup (`cleanEpisodeTemp`)**
  Removes temporary files to free disk space.

---

## 📂 Project Structure

```text
📦 project/
 ┣ 📂 inputs/            <- Source videos (manual)
 ┣ 📂 outputs/           <- Final upscaled videos
 ┣ 📂 temp/              <- Temporary frames and audio
 ┣ 📂 src/               <- TypeScript source code
 ┣ 📜 package.json
 ┣ 📜 bun.lockb
 ┣ 📜 .env
 ┗ 📜 README.md
```

---

## 📝 Notes

- **Storage:**
  Frame extraction generates thousands of images.
  Example: a 20-minute video at 24 FPS ≈ 28,000 images.
  Use an SSD/NVMe and ensure sufficient disk space.

- **Performance:**
  AI upscaling is GPU-intensive.
  By default, the pipeline attempts to use GPU acceleration if available.

- **Compatibility:**
  For CPU-only systems, consider adjusting:
  - FFmpeg codec (`libx264`)
  - Real-ESRGAN configuration (may be significantly slower)

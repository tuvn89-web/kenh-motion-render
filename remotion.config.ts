import {Config} from '@remotion/cli/config';

Config.setEntryPoint('src/index.ts');
Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(92);
Config.setCodec('h264');
// Windows + NVIDIA: draw with the GPU (faster for heavy SVG/WebGL scenes)
if (process.platform === 'win32') Config.setChromiumOpenGlRenderer('angle');

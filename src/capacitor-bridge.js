import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';
import { Network } from '@capacitor/network';
import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

window.CapBridge = {
    isNative: Capacitor.isNativePlatform(),
    Device,
    Network,
    SpeechRecognition,
    TextToSpeech
};

package com.alqubba.app;

import android.content.Context;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.os.Build;

/**
 * صوت المكالمة: وضع المكالمة، والتبديل بين السماعة (اللي بالأذن) والسبيكر.
 * إذا أكو سماعة بلوتوث أو سلكية، الصوت يروح لها بدال سماعة الأذن.
 */
final class CallAudio {

    private CallAudio() {
    }

    private static AudioManager am(Context c) {
        return (AudioManager) c.getSystemService(Context.AUDIO_SERVICE);
    }

    static void setActive(Context c, boolean active) {
        AudioManager am = am(c);
        if (am == null) return;
        try {
            if (active) {
                am.setMode(AudioManager.MODE_IN_COMMUNICATION);
            } else {
                if (Build.VERSION.SDK_INT >= 31) am.clearCommunicationDevice();
                else am.setSpeakerphoneOn(false);
                am.setMode(AudioManager.MODE_NORMAL);
            }
        } catch (Exception ignored) {
        }
    }

    static void setSpeaker(Context c, boolean on) {
        AudioManager am = am(c);
        if (am == null) return;
        try {
            if (Build.VERSION.SDK_INT >= 31) {
                AudioDeviceInfo speaker = null;
                AudioDeviceInfo earpiece = null;
                AudioDeviceInfo headset = null;
                for (AudioDeviceInfo d : am.getAvailableCommunicationDevices()) {
                    switch (d.getType()) {
                        case AudioDeviceInfo.TYPE_BUILTIN_SPEAKER:
                            speaker = d;
                            break;
                        case AudioDeviceInfo.TYPE_BUILTIN_EARPIECE:
                            earpiece = d;
                            break;
                        case AudioDeviceInfo.TYPE_BLUETOOTH_SCO:
                        case AudioDeviceInfo.TYPE_BLE_HEADSET:
                        case AudioDeviceInfo.TYPE_WIRED_HEADSET:
                        case AudioDeviceInfo.TYPE_WIRED_HEADPHONES:
                        case AudioDeviceInfo.TYPE_USB_HEADSET:
                            if (headset == null) headset = d;
                            break;
                        default:
                            break;
                    }
                }
                AudioDeviceInfo target = on ? speaker : (headset != null ? headset : earpiece);
                if (target != null) am.setCommunicationDevice(target);
                else if (!on) am.clearCommunicationDevice();
            } else {
                am.setSpeakerphoneOn(on);
            }
        } catch (Exception ignored) {
        }
    }
}

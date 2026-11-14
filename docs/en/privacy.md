# Safety & privacy

← [README](../../README.en.md) · [Polski](../pl/prywatnosc.md)

RibbitFlip only runs on your computer. The panel opens in your browser, but it is not a website on
the internet: nobody from outside can reach it. The app **never checks for updates, collects no
data about you and has no accounts**. It sends nothing on its own.

It connects to the internet or your network only when you tell it to, in six situations:

1. **The Services module** sends commands to the addresses you type in.
2. **The OBS Studio connection** only works with OBS on this computer or on your home network.
3. **Fetching a setup from a link** only works from Discord and GitHub.
4. **The Ko-fi mug** opens the Ko-fi page only once you click it.
5. **OSC** sends motion only to the address you type in (this computer by default).
6. **The RibbitBeat game** downloads MIDI packs from Hugging Face and a song from a pasted address,
   but only from the internet, never from your home network.

**The microphone** is needed in one place only: when you click **Record** in the instrument studio
to make your own sound sample. The browser asks for permission then, and the microphone goes off
once you stop recording or leave the studio. The recording stays on this computer — it is never
sent anywhere. Without that click the app never asks for the microphone and never turns it on.

Nothing reaches the system until you switch a module on. A loaded setup never switches a module
on for you, and the AI assistant does so only if you allow it in the MCP server card ("Assistant may
arm", off by default). The dashboard shows a note for every change it makes.
In simulation the motion is faked but the keys and clicks are real, which is why modules start off there and you confirm the first one you switch on.

**Emergency stop: `Alt`+`R`+`F`.** It always works, even while the panel is hidden, and switches
off every module on every capsule, the Scanner and the Selection wheel included (it also closes
the Scanner's window over the desktop). You turn them back on with the same switches. Change the
combination under **Settings → Emergency stop**. The right Alt (AltGr) never fires it, so
typing ł or ó is safe.

Technical details are under [Under the hood](developers.md#under-the-hood) and in [`SECURITY.md`](../../.github/SECURITY.md).
A map of every mechanism that controls the computer, with links to the code, is in
[Purpose and safeguards](purpose-and-safeguards.md).

' ============================================================================
'  Launcher for ribbitflip_audio.py
'  Runs the script COMPLETELY in the background - with no console window.
'
'  How to use:
'   1) Replace the two paths below with your own.
'   2) Drop this file into the Startup folder:
'        Win+R  ->  type:  shell:startup  ->  Enter  ->  drag this file in
'   3) Done. On every login the script starts silently in the background
'      and waits until you turn on the Triki controller.
' ============================================================================

' --- 1) Path to pythonw.exe ----------------------------------------------
'  Must be the pythonw.exe of THE Python where you installed the packages
'  (pip install bleak pynput). Find the path from a command prompt:
'        where pythonw
'  ...and paste the result below (keep the quotes):
pythonw = "C:\Users\YOUR_NAME\AppData\Local\Programs\Python\Python312\pythonw.exe"

' --- 2) Full path to the script ------------------------------------------
skrypt = "C:\Users\YOUR_NAME\ribbitflip_audio.py"

' --- (the rest runs itself) ----------------------------------------------
Set sh = CreateObject("WScript.Shell")
cmd = Chr(34) & pythonw & Chr(34) & " " & Chr(34) & skrypt & Chr(34)
sh.Run cmd, 0, False   ' 0 = hidden window, False = don't wait

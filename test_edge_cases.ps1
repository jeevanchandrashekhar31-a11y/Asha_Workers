Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer

# Edge Case 1: English, incomplete data
$synth.SetOutputToWaveFile('c:\Users\Jeevan c\Desktop\ASHA_Workers\field-agent\edge_case1.wav')
$synth.Speak("I visited the pregnant mother today. Her weight is 62 kilograms. That's all I have for now.")

# Edge Case 2: Hinglish (Hindi/English mix), complete data with messy phrasing
$synth.SetOutputToWaveFile('c:\Users\Jeevan c\Desktop\ASHA_Workers\field-agent\edge_case2.wav')
$synth.Speak("Maa ka weight 60 kilo hai. B P 110 over 70 hai. Iron ki goli de di hai. Agla checkup 10 October ko hoga.")

# Edge Case 3: Immunization visit, missing some fields
$synth.SetOutputToWaveFile('c:\Users\Jeevan c\Desktop\ASHA_Workers\field-agent\edge_case3.wav')
$synth.Speak("The baby was given the polio drops today. The weight is 5 point 2 kilograms. Mother is feeling fine.")

$synth.Dispose()

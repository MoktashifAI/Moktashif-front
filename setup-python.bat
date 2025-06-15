@echo off
echo Setting up Python environment for Moktashif...

REM Install required Python packages
echo Installing Python packages from requirements.txt...
pip install -r src\Components\ChatBot\requirements.txt

echo Python environment setup complete!
pause 
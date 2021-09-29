@cd "%~dp0\.."
docker run -it --rm --init -p 3000:3000 -v "%cd%:/home/workspace:cached" gitpod/openvscode-server
@pause
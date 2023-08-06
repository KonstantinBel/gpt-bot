build:
	docker image rm -f gptbot && docker build -t gptbot .

start:
	docker run -d -p 3000:3000 --name gptbot gptbot

stop:
	docker stop gptbot && docker rm gptbot

debug:
	docker exec -it gptbot sh

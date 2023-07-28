build:
	docker image rm -f gptbot && docker build -t gptbot .

run:
	docker run -d -p 3000:3000 --name gptbot --rm gptbot

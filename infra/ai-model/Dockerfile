# Bakes the embedding model into the image at build time (rather than pulling it at container
# startup) — slower image build, but the container is ready to serve embeddings immediately on
# first boot, with no runtime download race for ai-worker's healthcheck-gated depends_on to wait
# out. No VOLUME is declared by the upstream ollama/ollama image, so this RUN layer's model data
# becomes part of the image and correctly seeds docker-compose's ollama-data named volume the
# first time it's mounted (an empty named volume is initialized from the image's contents at that
# path).
FROM ollama/ollama:latest

RUN (ollama serve &) \
    && for i in $(seq 1 30); do ollama list >/dev/null 2>&1 && break; sleep 1; done \
    && ollama pull nomic-embed-text

FROM pandoc/core:2.14.1 as pandoc

FROM node:16.6.1-alpine

# Copy pandoc binaries from pandoc/core
COPY --from=pandoc \
    /usr/local/bin/pandoc \
    /usr/local/bin/pandoc-citeproc \
    /usr/local/bin/

# Reinstall any system packages required for pandoc runtime.
RUN apk --no-cache add \
        gmp \
        libffi \
        lua5.3 \
        lua5.3-lpeg

WORKDIR /docbuilder

COPY package.json package-lock.json ./

RUN npm install --production

COPY . .

RUN chmod +x md2pdf.js && ln -s /docbuilder/md2pdf.js /usr/local/bin/md2pdf

ENTRYPOINT [""]
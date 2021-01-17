# subops
Manages subscriber operations for [my blog](https://utkuufuk.com).

## Configuration
### Set Remote Configuration
```sh
firebase functions:config:set mailgun.api_key=<api_key>
firebase functions:config:set mailgun.domain=<domain>
firebase functions:config:set mailgun.email=<admin_email>
```

### Import Remote Configuration to Local Environment
```sh
firebase functions:config:get > functions/.runtimeconfig.json
```

## Dev Setup
Within the `funcitons` dir:
```sh
# install or upgrade firebase-tools globally
npm install -g firebase-tools

# update both the CLI and the SDK
npm install firebase-functions@latest firebase-admin@latest --save

# install dependencies
npm install

# login
firebase login
```

## Publishing Blog Posts
1. Update `publish.sh` with the correct `<post_header>` and `<post_url>` values.

2. Serve functions locally:
    ```sh
    npm run serve
    ```

3. Run `./publish.sh`

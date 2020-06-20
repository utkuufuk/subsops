# subops
Manages subscriber operations for [my blog](https://utkuufuk.com).

## Serve Functions Locally or Deploy to Cloud
Serve functions locally without deploying functions to cloud:
``` sh
# default port is 5000
sudo firebase serve --only functions --port=5123
```

Deploy functions to cloud:
``` sh
npm run deploy
```

## Configuration
### Set Remote Configuration
```sh
firebase functions:config:set mailgun.api_key=<api_key>
firebase functions:config:set mailgun.domain=<domain>
firebase functions:config:set mailgun.email=<admin_email>
```

### Retrieve Current Envvironment Configuration
```sh
firebase functions:config:get
```

### Import Remote Configuration to Local Environment
```sh
firebase functions:config:get > functions/.runtimeconfig.json
```

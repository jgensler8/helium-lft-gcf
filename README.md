# helmium-lft-gcf

Helium Large File Transfer Google Cloud Functions and Library.

## Create a Configuration File

```
$ cat ./configuration.json
{
  "CLOUD_REGION": "us-central1",
  "REGISTRY_ID": "myregistry",
  "DEVICE_ID": "Helium-1111111111111111"
}
```

## Ensure Service Account JSON File Exists

```
cat ./service-account.json
{
  "type": "service_account",
  "project_id": "xx",
  "private_key_id": "xx",
  "private_key": "-----BEGIN PRIVATE KEY-----\xx\n-----END PRIVATE KEY-----\n",
  "client_email": xx@xx.iam.gserviceaccount.com",
  "client_id": "xx",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://accounts.google.com/o/oauth2/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/xx%xx.iam.gserviceaccount.com"
}
```

## Uploading Pub/Sub Events to Datastore

```
npm run deploy
```

## Assembling LFT Events from a Datastore

```
assembleBlobFromDatastore(datastore, transaction_id, function(err, file) {
  if( err != null ) {
    console.log(err);
    return err;
  }
  
  console.log(file);
})
```

## Testing

### Unit

```
npm test
```

### Integration

```
npm run test_integration
```

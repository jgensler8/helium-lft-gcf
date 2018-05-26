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

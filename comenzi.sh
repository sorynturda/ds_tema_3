az container delete --resource-group ds-tema-3-rg --name ds-tema-3-group --yes
az container create --resource-group ds-tema-3-rg --file deploy.yaml

az container show --resource-group ds-tema-3-rg --name ds-tema-3-group --query "containers[].{Name:name, State:instanceView.currentState.state}" --output table


az container logs --resource-group ds-tema-3-rg --name ds-tema-3-group --container-name rp

while true; do date; az container logs --resource-group ds-tema-3-rg --name ds-tema-3-group --container-name monitoring-service-1;sleep 1; done



az container exec --resource-group ds-tema-3-rg --name ds-tema-3-group --container-name credential-db --exec-command "/bin/sh"
> psql -h 127.0.0.1 -U postgres -p 5434


az ad sp create-for-rbac --name "GitHub-Actions-ACI" --role contributor \
  --scopes /subscriptions/704305b6-249d-4cb4-968d-969ecd329eed/resourceGroups/ds-tema-3-rg \
  --sdk-auth
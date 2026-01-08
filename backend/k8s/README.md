# Manifests Kubernetes - GLA Crypto Backend

## Structure des fichiers

```
k8s/
├── kustomization.yaml      # Configuration Kustomize
├── namespace.yaml          # Namespace gla-crypto
├── configmap.yaml          # Variables d'environnement
├── secrets.yaml            # Secrets backend (JWT, DB URL)
├── postgres-secrets.yaml   # Secrets PostgreSQL
├── postgres-pvc.yaml       # Volume persistant pour la DB
├── postgres-deployment.yaml # Déploiement PostgreSQL
├── postgres-service.yaml   # Service PostgreSQL
├── backend-deployment.yaml # Déploiement Backend (2 replicas)
├── backend-service.yaml    # Service Backend
├── ingress.yaml            # Ingress pour accès externe
└── hpa.yaml                # Auto-scaling horizontal
```

## Prérequis

- Kubernetes cluster (minikube, kind, ou cloud provider)
- kubectl configuré
- (Optionnel) Ingress controller installé

## Déploiement rapide

### 1. Avec Kustomize (recommandé)

```bash
# Prévisualiser les ressources
kubectl kustomize k8s/

# Appliquer les manifests
kubectl apply -k k8s/

# Vérifier le déploiement
kubectl get all -n gla-crypto
```

### 2. Fichier par fichier

```bash
# Créer le namespace
kubectl apply -f k8s/namespace.yaml

# Appliquer les configurations
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/postgres-secrets.yaml

# Déployer PostgreSQL
kubectl apply -f k8s/postgres-pvc.yaml
kubectl apply -f k8s/postgres-deployment.yaml
kubectl apply -f k8s/postgres-service.yaml

# Attendre que PostgreSQL soit prêt
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=postgres -n gla-crypto --timeout=120s

# Déployer le backend
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/backend-service.yaml

# (Optionnel) Ingress et HPA
kubectl apply -f k8s/ingress.yaml
kubectl apply -f k8s/hpa.yaml
```

## Configuration

### Modifier les secrets (IMPORTANT en production)

```bash
# Encoder les secrets en base64
echo -n "votre_jwt_secret" | base64

# Éditer le fichier secrets.yaml avec les vraies valeurs
kubectl edit secret backend-secrets -n gla-crypto
```

### Changer l'image du backend

```bash
# Avec Kustomize
cd k8s
kustomize edit set image gla-backend=your-registry/gla-backend:v1.0.0
kubectl apply -k .
```

## Accès à l'application

### Port-forward (développement)

```bash
# Accès au backend
kubectl port-forward svc/backend 3001:3001 -n gla-crypto

# Accès à PostgreSQL
kubectl port-forward svc/postgres 5432:5432 -n gla-crypto
```

### Via Ingress (production)

Ajouter dans `/etc/hosts` :

```
<INGRESS_IP> api.gla-crypto.local
```

Puis accéder à : `http://api.gla-crypto.local`

## Monitoring

### Vérifier les pods

```bash
kubectl get pods -n gla-crypto
kubectl logs -f deployment/backend -n gla-crypto
```

### Vérifier les métriques

```bash
kubectl port-forward svc/backend 3001:3001 -n gla-crypto
curl http://localhost:3001/metrics
```

### Vérifier le HPA

```bash
kubectl get hpa -n gla-crypto
kubectl describe hpa backend-hpa -n gla-crypto
```

## Mise à jour

### Rolling update

```bash
# Mettre à jour l'image
kubectl set image deployment/backend backend=gla-backend:v2.0.0 -n gla-crypto

# Suivre le rollout
kubectl rollout status deployment/backend -n gla-crypto

# Rollback si nécessaire
kubectl rollout undo deployment/backend -n gla-crypto
```

## Nettoyage

```bash
# Supprimer toutes les ressources
kubectl delete -k k8s/

# Ou supprimer le namespace (supprime tout)
kubectl delete namespace gla-crypto
```

## Architecture

```
                    ┌─────────────┐
                    │   Ingress   │
                    │  (nginx)    │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │   Service   │
                    │  (backend)  │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼─────┐    ┌─────▼─────┐    ┌─────▼─────┐
    │  Backend  │    │  Backend  │    │  Backend  │
    │  Pod #1   │    │  Pod #2   │    │  Pod #N   │
    └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
          │                │                │
          └────────────────┼────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Service   │
                    │ (postgres)  │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  PostgreSQL │
                    │    Pod      │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │    PVC      │
                    │  (5Gi)      │
                    └─────────────┘
```

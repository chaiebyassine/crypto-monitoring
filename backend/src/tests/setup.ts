import { vi, beforeEach, afterEach } from "vitest";
import nock from "nock";

// Reset tous les mocks avant chaque test
beforeEach(() => {
  vi.clearAllMocks();
  nock.cleanAll();
});

// Nettoyer après chaque test
afterEach(() => {
  nock.cleanAll();
});

// Désactiver les vraies requêtes HTTP pendant les tests
nock.disableNetConnect();
// Permettre localhost pour les tests d'intégration
nock.enableNetConnect("127.0.0.1");

//! Tracks active cancellation tokens per run-id so a separate API call can
//! cancel an in-flight request.

use std::collections::BTreeMap;
use std::sync::Arc;

use tokio::sync::Mutex;
use tokio_util::sync::CancellationToken;

#[derive(Clone, Default)]
pub struct RunRegistry {
    inner: Arc<Mutex<BTreeMap<String, CancellationToken>>>,
}

impl RunRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    pub async fn insert(&self, id: String, token: CancellationToken) {
        self.inner.lock().await.insert(id, token);
    }

    pub async fn remove(&self, id: &str) {
        self.inner.lock().await.remove(id);
    }

    pub async fn cancel(&self, id: &str) -> bool {
        let token = self.inner.lock().await.get(id).cloned();
        if let Some(token) = token {
            token.cancel();
            true
        } else {
            false
        }
    }
}

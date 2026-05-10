//! Auth strategies attached to a request. Stored alongside the rest of
//! the request body in YAML; resolved (with secret + variable lookup) at
//! run time by the runner.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum Auth {
    Bearer {
        token: String,
    },
    Basic {
        username: String,
        password: String,
    },
    ApiKey {
        name: String,
        value: String,
        #[serde(default)]
        location: ApiKeyLocation,
    },
    /// Reserved for a future implementation. Currently runner returns an error.
    Oauth2 {
        #[serde(default, skip_serializing_if = "Option::is_none")]
        token: Option<String>,
    },
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum ApiKeyLocation {
    #[default]
    Header,
    Query,
}

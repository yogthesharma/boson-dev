//! Request body shapes. Custom serde lets users write either a plain string
//! (legacy `body: "raw text"`) or a tagged object distinguishing JSON, form,
//! and multipart payloads.

use std::collections::BTreeMap;
use std::fmt;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub enum RequestBody {
    #[default]
    None,
    Text {
        content_type: Option<String>,
        value: String,
    },
    Json {
        value: serde_json::Value,
    },
    Form {
        fields: BTreeMap<String, String>,
    },
    Multipart {
        fields: Vec<MultipartField>,
    },
}

impl RequestBody {
    pub fn is_none(&self) -> bool {
        matches!(self, RequestBody::None)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MultipartField {
    pub name: String,
    // `deny_unknown_fields` doesn't compose with `flatten`, so we don't apply
    // it on this struct. The flattened tag still narrows shape via the inner
    // enum.
    #[serde(flatten)]
    pub source: MultipartSource,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "snake_case", deny_unknown_fields)]
pub enum MultipartSource {
    Text {
        value: String,
    },
    File {
        /// Path relative to the project root.
        path: String,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        content_type: Option<String>,
        #[serde(default, skip_serializing_if = "Option::is_none")]
        file_name: Option<String>,
    },
}

impl Serialize for RequestBody {
    fn serialize<S: serde::Serializer>(&self, ser: S) -> Result<S::Ok, S::Error> {
        match self {
            RequestBody::None => ser.serialize_none(),
            RequestBody::Text {
                content_type: None,
                value,
            } => ser.serialize_str(value),
            RequestBody::Text {
                content_type,
                value,
            } => {
                use serde::ser::SerializeMap;
                let mut map = ser.serialize_map(Some(3))?;
                map.serialize_entry("kind", "text")?;
                map.serialize_entry("content_type", content_type)?;
                map.serialize_entry("value", value)?;
                map.end()
            }
            RequestBody::Json { value } => {
                use serde::ser::SerializeMap;
                let mut map = ser.serialize_map(Some(2))?;
                map.serialize_entry("kind", "json")?;
                map.serialize_entry("value", value)?;
                map.end()
            }
            RequestBody::Form { fields } => {
                use serde::ser::SerializeMap;
                let mut map = ser.serialize_map(Some(2))?;
                map.serialize_entry("kind", "form")?;
                map.serialize_entry("fields", fields)?;
                map.end()
            }
            RequestBody::Multipart { fields } => {
                use serde::ser::SerializeMap;
                let mut map = ser.serialize_map(Some(2))?;
                map.serialize_entry("kind", "multipart")?;
                map.serialize_entry("fields", fields)?;
                map.end()
            }
        }
    }
}

impl<'de> Deserialize<'de> for RequestBody {
    fn deserialize<D: serde::Deserializer<'de>>(de: D) -> Result<Self, D::Error> {
        struct V;
        impl<'de> serde::de::Visitor<'de> for V {
            type Value = RequestBody;
            fn expecting(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
                f.write_str("null, a string, or a tagged body object")
            }
            fn visit_unit<E: serde::de::Error>(self) -> Result<Self::Value, E> {
                Ok(RequestBody::None)
            }
            fn visit_none<E: serde::de::Error>(self) -> Result<Self::Value, E> {
                Ok(RequestBody::None)
            }
            fn visit_some<D: serde::Deserializer<'de>>(
                self,
                de: D,
            ) -> Result<Self::Value, D::Error> {
                de.deserialize_any(V)
            }
            fn visit_str<E: serde::de::Error>(self, v: &str) -> Result<Self::Value, E> {
                Ok(RequestBody::Text {
                    content_type: None,
                    value: v.to_string(),
                })
            }
            fn visit_string<E: serde::de::Error>(self, v: String) -> Result<Self::Value, E> {
                Ok(RequestBody::Text {
                    content_type: None,
                    value: v,
                })
            }
            fn visit_map<A: serde::de::MapAccess<'de>>(
                self,
                map: A,
            ) -> Result<Self::Value, A::Error> {
                #[derive(Deserialize)]
                #[serde(tag = "kind", rename_all = "snake_case")]
                enum Tagged {
                    Text {
                        #[serde(default)]
                        content_type: Option<String>,
                        #[serde(default)]
                        value: String,
                    },
                    Json {
                        value: serde_json::Value,
                    },
                    Form {
                        #[serde(default)]
                        fields: BTreeMap<String, String>,
                    },
                    Multipart {
                        #[serde(default)]
                        fields: Vec<MultipartField>,
                    },
                }
                let de = serde::de::value::MapAccessDeserializer::new(map);
                Ok(match Tagged::deserialize(de)? {
                    Tagged::Text {
                        content_type,
                        value,
                    } => RequestBody::Text {
                        content_type,
                        value,
                    },
                    Tagged::Json { value } => RequestBody::Json { value },
                    Tagged::Form { fields } => RequestBody::Form { fields },
                    Tagged::Multipart { fields } => RequestBody::Multipart { fields },
                })
            }
        }
        de.deserialize_any(V)
    }
}

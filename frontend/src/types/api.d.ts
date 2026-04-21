export interface paths {
  "/api/projects": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["ProjectListResponse"];
          };
        };
      };
    };
    post: {
      requestBody: {
        content: {
          "application/json": components["schemas"]["ProjectCreateRequest"];
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["Project"];
          };
        };
      };
    };
  };
  "/api/library": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": { items: components["schemas"]["Asset"][] };
          };
        };
      };
    };
  };
  "/api/uploads": {
    post: {
      requestBody: {
        content: {
          "multipart/form-data": { file: string };
        };
      };
      responses: {
        200: {
          content: {
            "application/json": components["schemas"]["Asset"];
          };
        };
      };
    };
  };
  "/api/pipeline_payloads": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": Record<string, unknown>;
          };
        };
      };
    };
  };
  "/api/settings": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": Record<string, unknown>;
          };
        };
      };
    };
  };
  "/api/batch": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": Record<string, unknown>;
          };
        };
      };
    };
  };
  "/api/video": {
    get: {
      responses: {
        200: {
          content: {
            "application/json": Record<string, unknown>;
          };
        };
      };
    };
  };
}

export interface components {
  schemas: {
    Project: {
      id: string;
      name: string;
      created_at: string;
      updated_at: string;
      cover_url?: string;
      pipeline_hint?: string;
      task_count: number;
      last_task_id?: string;
    };
    ProjectListResponse: {
      items: components["schemas"]["Project"][];
    };
    ProjectCreateRequest: {
      name: string;
    };
    Asset: {
      id: string;
      url: string;
      type: string;
    }
  };
}

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
  };
}

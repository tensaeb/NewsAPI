export type BaseResponse<T> = {
  Success: boolean;
  Message: string;
  Object: T | null;
  Errors: string[] | null;
};

export type PaginatedResponse<T> = {
  Success: boolean;
  Message: string;
  Object: T[];
  PageNumber: number;
  PageSize: number;
  TotalSize: number;
  Errors: null;
};

export function okResponse<T>(message: string, object: T | null = null): BaseResponse<T> {
  return { Success: true, Message: message, Object: object, Errors: null };
}

export function failResponse<T>(message: string, errors: string[]): BaseResponse<T> {
  return { Success: false, Message: message, Object: null, Errors: errors };
}

export function paginatedOk<T>(
  message: string,
  items: T[],
  pageNumber: number,
  pageSize: number,
  totalSize: number,
): PaginatedResponse<T> {
  return {
    Success: true,
    Message: message,
    Object: items,
    PageNumber: pageNumber,
    PageSize: pageSize,
    TotalSize: totalSize,
    Errors: null,
  };
}

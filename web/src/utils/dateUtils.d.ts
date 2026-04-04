/**
 * 日付・時刻フォーマット用のユーティリティ関数
 */
/**
 * UTC時刻文字列を日本時間でフォーマットして表示
 * @param dateString UTC時刻文字列（タイムゾーン情報の有無は問わない）
 * @returns 日本時間でフォーマットされた文字列
 */
export declare const formatDateTimeJST: (dateString: string) => string;
/**
 * UTC時刻文字列を日本時間の日付のみでフォーマット
 * @param dateString UTC時刻文字列
 * @returns 日本時間の日付文字列（例: "2025/07/31"）
 */
export declare const formatDateJST: (dateString: string) => string;
/**
 * UTC時刻文字列を日本時間の時刻のみでフォーマット
 * @param dateString UTC時刻文字列
 * @returns 日本時間の時刻文字列（例: "15:42:49"）
 */
export declare const formatTimeJST: (dateString: string) => string;

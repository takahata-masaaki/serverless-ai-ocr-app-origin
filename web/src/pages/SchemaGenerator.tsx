import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../utils/api";
import SchemaPreview from "../components/SchemaPreview";
import { Field } from "../types/app-schema";

interface SchemaData {
  name?: string;
  display_name?: string;
  description?: string;
  fields: Field[];
  prompt?: string;
  updated_at?: string;
}

interface SchemaGeneratorProps {
  mode?: "create" | "edit" | "view";
}

const SchemaGenerator: React.FC<SchemaGeneratorProps> = ({ mode = "create" }) => {
  const navigate = useNavigate();
  const { appName: urlAppName } = useParams();

  const isEditMode = mode === "edit" || !!urlAppName;
  const isViewMode = mode === "view";

  const [appName, setAppName] = useState(urlAppName || "");
  const [appDisplayName, setAppDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [extractionInstructions, setExtractionInstructions] = useState(
    "アップロードされたPDF/画像から、重要項目を自動で抽出し、忠実にデータ化してください。"
  );
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [generatedSchema, setGeneratedSchema] = useState<SchemaData | null>(null);
  const [fieldsJson, setFieldsJson] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!urlAppName) return;

    const loadApp = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await api.get(`/ocr/apps/${urlAppName}`);
        const appData = response.data;

        setAppName(appData.name || urlAppName);
        setAppDisplayName(appData.display_name || appData.name || urlAppName);
        setDescription(appData.description || "");
        setGeneratedSchema(appData);

        if (Array.isArray(appData.fields)) {
          setFieldsJson(JSON.stringify(appData.fields, null, 2));
        } else {
          setFieldsJson("[]");
        }
      } catch (e: any) {
        console.error("アプリ読込エラー:", e);
        setError(e?.response?.data?.error || e?.message || "アプリの読込に失敗しました");
      } finally {
        setLoading(false);
      }
    };

    loadApp();
  }, [urlAppName]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setUploadedFile(file);
  };

  const generateSchema = async () => {
    if (!uploadedFile) {
      setError("ファイルを選択してください");
      return;
    }

    const targetAppName = (appName || "test_app").trim();

    setIsGenerating(true);
    setError(null);

    try {
      const presignedUrlResponse = await api.post("/ocr/apps/schema/generate-presigned-url", {
        app_name: targetAppName,
        file_name: uploadedFile.name,
        filename: uploadedFile.name,
        content_type: uploadedFile.type,
        contentType: uploadedFile.type,
      });

      const { presigned_url, s3_key } = presignedUrlResponse.data;

      await fetch(presigned_url, {
        method: "PUT",
        body: uploadedFile,
        headers: {
          "Content-Type": uploadedFile.type,
        },
      });

      const schemaResponse = await api.post(`/ocr/apps/${targetAppName}/schema/generate`, {
        app_name: targetAppName,
        s3_key,
        file_name: uploadedFile.name,
        filename: uploadedFile.name,
        instructions: extractionInstructions || "",
      });

      const schema = schemaResponse.data;
      setGeneratedSchema(schema);

      if (Array.isArray(schema.fields)) {
        setFieldsJson(JSON.stringify(schema.fields, null, 2));
      } else {
        setFieldsJson("[]");
      }

      if (schema.name && !appName) {
        setAppName(schema.name);
      }
      if (schema.display_name && !appDisplayName) {
        setAppDisplayName(schema.display_name);
      }
    } catch (e: any) {
      console.error("スキーマ生成エラー:", e);
      setError(e?.response?.data?.error || e?.message || "スキーマ生成に失敗しました");
    } finally {
      setIsGenerating(false);
    }
  };

  const regenerateSchema = async () => {
    await generateSchema();
  };

  const saveSchema = async () => {
    const targetAppName = (appName || urlAppName || "").trim();
    if (!targetAppName) {
      setError("アプリ名を入力してください");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      let parsedFields: Field[] = [];
      try {
        parsedFields = JSON.parse(fieldsJson || "[]");
        if (!Array.isArray(parsedFields)) {
          throw new Error("fields must be an array");
        }
      } catch {
        setError("フィールド定義(JSON)の形式が不正です");
        setIsSaving(false);
        return;
      }

      const finalSchema: SchemaData = {
        name: targetAppName,
        display_name: appDisplayName || targetAppName,
        description: description || "",
        fields: parsedFields,
        prompt: "",
      };

      if (urlAppName) {
        await api.put(`/ocr/apps/${targetAppName}`, finalSchema);
      } else {
        await api.post("/ocr/apps", finalSchema);
      }

      navigate(`/app/${targetAppName}`);
    } catch (e: any) {
      console.error("保存エラー:", e);
      setError(e?.response?.data?.error || e?.message || "保存に失敗しました");
    } finally {
      setIsSaving(false);
    }
  };

  const parsedSchemaForPreview = (() => {
    try {
      const arr = JSON.parse(fieldsJson || "[]");
      return { fields: Array.isArray(arr) ? arr : [] };
    } catch {
      return { fields: [] };
    }
  })();

  if (loading) {
    return <div className="p-6">読み込み中...</div>;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">{isEditMode ? "スキーマ編集" : "新規ユースケース作成"}</h1>
        <div className="flex gap-2">
          <button
            onClick={saveSchema}
            disabled={isSaving}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded"
          >
            {isSaving ? "保存中..." : "作成"}
          </button>
          <button
            onClick={() => navigate(urlAppName ? `/app/${urlAppName}` : "/")}
            className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
          >
            キャンセル
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded bg-red-100 text-red-700 border border-red-300">
          アプリケーションに{error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-2xl font-bold mb-4">基本情報</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block font-semibold mb-2">アプリ名（英数字）</label>
            <input
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="w-full border rounded px-3 py-2"
              disabled={!!urlAppName}
            />
          </div>
          <div>
            <label className="block font-semibold mb-2">表示名</label>
            <input
              value={appDisplayName}
              onChange={(e) => setAppDisplayName(e.target.value)}
              className="w-full border rounded px-3 py-2"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold mb-2">説明（オプション）</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full border rounded px-3 py-2"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-2xl font-bold mb-4">サンプル画像アップロード</h2>

          <label className="block font-semibold mb-2">スキーマ生成の指示（オプション）</label>
          <textarea
            value={extractionInstructions}
            onChange={(e) => setExtractionInstructions(e.target.value)}
            rows={3}
            className="w-full border rounded px-3 py-2 mb-4"
          />

          <input type="file" onChange={handleFileChange} className="mb-4" />

          {uploadedFile && (
            <div className="border border-dashed rounded p-4 mb-4">
              <div className="font-medium">{uploadedFile.name}</div>
              <div className="text-sm text-gray-500">{(uploadedFile.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
          )}

          <button
            onClick={generateSchema}
            disabled={!uploadedFile || isGenerating}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
          >
            {isGenerating ? "生成中..." : "スキーマを生成"}
          </button>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">スキーマ定義</h2>
            {generatedSchema && !isViewMode && (
              <button
                onClick={regenerateSchema}
                disabled={isGenerating}
                className="text-blue-500 hover:text-blue-700"
              >
                再生成
              </button>
            )}
          </div>

          <label className="block font-semibold mb-2">フィールド定義 (JSON)</label>
          <textarea
            value={fieldsJson}
            onChange={(e) => setFieldsJson(e.target.value)}
            rows={14}
            className="w-full border rounded px-3 py-2 font-mono mb-6"
          />

          <h3 className="text-xl font-bold mb-2">プレビュー</h3>
          {parsedSchemaForPreview.fields.length > 0 ? (
            <SchemaPreview schema={parsedSchemaForPreview} />
          ) : (
            <div className="text-gray-400 py-8 text-center">有効なスキーマがありません</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SchemaGenerator;

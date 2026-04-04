import React from 'react';
import { Field } from '../types/app-schema';
interface SchemaPreviewProps {
    schema: {
        fields: Field[];
    } | null;
}
declare const SchemaPreview: React.FC<SchemaPreviewProps>;
export default SchemaPreview;

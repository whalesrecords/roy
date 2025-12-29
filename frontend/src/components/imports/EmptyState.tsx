'use client';

import { Card, CardBody } from '@heroui/react';

export default function EmptyState() {
  return (
    <Card className="bg-default-50">
      <CardBody className="py-12 px-4">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-default-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-default-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-foreground mb-1">
            Aucun import
          </h3>
          <p className="text-default-500">
            Commencez par uploader un fichier CSV de vos ventes
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

package apiserver

import (
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"time"

	"github.com/gorilla/mux"
	"github.com/replicatedhq/kotsadm/pkg/handlers"
)

func Start() {
	u, err := url.Parse("http://kotsadm-api-node:3000")
	if err != nil {
		panic(err)
	}
	upstream := httputil.NewSingleHostReverseProxy(u)

	r := mux.NewRouter()
	r.Use(mux.CORSMethodMiddleware(r))

	r.HandleFunc("/healthz", handlers.Healthz)

	// proxy all graphql requests
	r.Path("/graphql").Methods("OPTIONS").HandlerFunc(handlers.CORS)
	r.Path("/graphql").Methods("POST").HandlerFunc(handlers.NodeProxy(upstream))

	// Functions that the operator calls
	r.Path("/api/v1/appstatus").Methods("PUT").HandlerFunc(handlers.NodeProxy(upstream))
	r.Path("/api/v1/deploy/result").Methods("PUT").HandlerFunc(handlers.NodeProxy(upstream))
	r.Path("/api/v1/preflight/{appSlug}/{clusterSlug}/{sequence}").Methods("GET").HandlerFunc(handlers.NodeProxy(upstream))
	r.Path("/api/v1/preflight/{appSlug}/{clusterSlug}/{sequence}").Methods("POST").HandlerFunc(handlers.NodeProxy(upstream))
	r.Path("/api/v1/troubleshoot/{appSlug}").Methods("GET").HandlerFunc(handlers.NodeProxy(upstream))
	r.Path("/api/v1/troubleshoot/{appId}/{bundleId}").Methods("PUT").HandlerFunc(handlers.NodeProxy(upstream))

	r.Path("/api/v1/troubleshoot/supportbundle/{bundleId}/download").Methods("GET").HandlerFunc(handlers.NodeProxy(upstream))

	// proxy for license/titled api
	r.Path("/license/v1/license").Methods("GET").HandlerFunc(handlers.NodeProxy(upstream))

	// Implemented handlers
	r.HandleFunc("/api/v1/login", handlers.Login)
	r.HandleFunc("/api/v1/logout", handlers.NotImplemented)
	r.Path("/api/v1/metadata").Methods("OPTIONS", "GET").HandlerFunc(handlers.Metadata)

	// TODO

	// KURL
	r.HandleFunc("/api/v1/kurl", handlers.NotImplemented)

	// Prom
	r.HandleFunc("/api/v1/prometheus", handlers.NotImplemented)

	// GitOps
	r.HandleFunc("/api/v1/gitops", handlers.NotImplemented)

	// License
	r.HandleFunc("/api/v1/license", handlers.NotImplemented)

	// to avoid confusion, we don't serve this in the dev env...
	if os.Getenv("DISABLE_SPA_SERVING") != "1" {
		spa := handlers.SPAHandler{StaticPath: filepath.Join("web", "dist"), IndexPath: "index.html"}
		r.PathPrefix("/").Handler(spa)
	}

	srv := &http.Server{
		Handler:      r,
		Addr:         ":3000",
		WriteTimeout: 2 * time.Minute,
		ReadTimeout:  2 * time.Minute,
	}

	fmt.Printf("Starting kotsadm API on port %d...\n", 3000)

	log.Fatal(srv.ListenAndServe())
}

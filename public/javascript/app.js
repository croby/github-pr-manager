$(function() {
    var current_page = 0,
        current_issue = false,
        merge_type = false;

    var handle_pagination_click = function( $elt ) {
        if ( !$elt.parent( "li" ).hasClass( "disabled" ) ) {
            var direction = $elt.parent( "li" ).hasClass( "prev" ) ? -1 : 1;
            current_page += direction;
            refresh_pull_requests();
            if ( current_page === 0 ) {
                $( ".pagination li.prev" ).addClass( "disabled" );
            } else {
                $( ".pagination li.disabled" ).removeClass( "disabled" );
            }
        }
    };


    var refresh_pull_requests = function() {
        $( ".pagination" ).hide();
        $( "#pull_requests" ).fadeOut( "fast", function() {
            $( "#pull_request_loading" ).fadeIn( "fast", function() {
                $.ajax({
                    url: "/pulls",
                    data: {
                        page: current_page
                    },
                    success: function( data ) {
                        $( "#pull_request_loading" ).fadeOut( "fast", function() {
                            $( "#pull_requests" ).html( data.pulls ).show();
                            $( ".pagination li.next" ).toggleClass( "disabled", !data.has_next_page );
                            if ( $( ".pagination li.disabled" ).length !== 2 ) {
                                $( ".pagination" ).show();
                            }
                            $( "#main" ).fadeIn( "fast" );
                        });
                    }
                });
            });
        });
    };

    var refresh_sidebar = function ( data, doRequest ) {
        if ( doRequest ) {
            $.ajax({
                url: "/sidebar",
                success: function( data ) {
                    refresh_sidebar( data );
                }
            });
        } else {
            $( "div.sidebar" ).html( data.html ).find( ".new" ).fadeIn( "slow" );
            $( "pre.modified" ).html( $( "div.sidebar" ).find( ".modified" ).html() );
            if ( !data.clean ) {
                $( "#force_warning" ).html( data.force_html );
            }
        }
    };

    var do_reset = function( branch, force, callback ) {
        var params = {
            force: force || false
        };
        $.ajax({
            url: "/reset",
            type: "POST",
            data: params,
            success: function( data ) {
                refresh_sidebar( data.sidebar );
                $( ".current_branch" ).fadeOut( "fast", function() {
                    $( ".current_branch" ).text( data.branch ).fadeIn( "fast" );
                    if ( $.isFunction( callback ) ) {
                        callback();
                    }
                });
            }
        });
    };

    var back_to_pull_requests = function( callback ) {
        $( "#pull_request_focus" ).fadeOut( "fast", function() {
            $( "#pull_requests" ).fadeIn( "fast", function() {
                if ( $.isFunction( callback ) ) {
                    callback();
                }
            });
        });
    };

    var show_pull_request = function( issue, url ) {
        current_issue = issue;
        $( ".pagination" ).hide();
        $( "#pull_requests" ).fadeOut( "fast", function() {
            $( "#focus_loading" ).fadeIn( "fast", function() {
                get_pull_request( issue, function( data ) {
                    $( "#pull_request_focus" ).hide().html( data );
                    $( "#focus_loading" ).fadeOut( "fast", function() {
                        $( "#pull_request_focus" ).fadeIn( "fast" );
                    });
                });
            });
        });
    };

    var get_pull_request = function( issue, callback ) {
        $.ajax({
            url: "/pulls/" + issue,
            type: "GET",
            success: function( data ) {
                if ( $.isFunction( callback ) ) {
                    callback( data );
                }
            }
        });
    };

    var toggle_buttons = function( enable ) {
        if ( enable ) {
            $( ".focus_actions button" ).removeAttr( "disabled" );
        } else {
            $( ".focus_actions button" ).attr( "disabled", "disabled" );
        }
    };

    var working = function( starting ) {
        if ( starting ) {
            $( "#working" ).modal( "show" );
        } else {
            $( "#working" ).modal( "hide" );
        }
    };

    var do_validate = function( issue, callback ) {
        $.ajax({
            url: "/validate/" + issue,
            type: "GET",
            success: function( data ) {
                if ( data.success ) {
                    $( ".current_branch" ).fadeOut( "fast", function() {
                        $( ".current_branch" ).text( data.branch ).fadeIn( "fast", function() {
                            if ( $.isFunction( callback ) ) {
                                callback();
                            }                            
                        });
                    });
                }
            }
        });
    };

    var show_merge = function( type, callback ) {
        merge_type = type;
        $( "#pull_request_focus .focus_actions" ).fadeOut( "fast", function() {
            $( ".focus_step[data-step='" + type + "']" ).fadeIn( "fast", function() {
                var top = $( ".focus_step[data-step='" + type + "']" ).offset().top;
                $( "html" ).animate({
                    scrollTop: top
                }, 200);
            });
        });
    };

    var cancel_merge = function( callback ) {
        $( ".focus_step[data-step]" ).fadeOut( "fast", function() {
            $( "#pull_request_focus .focus_actions" ).fadeIn( "fast", function() {
                if ( $.isFunction( callback ) ) {
                    callback();
                }
            });
        });
    };

    var get_merge_message = function() {
        var header = $( ".merge_message_header:visible" ).text();
        var body = $( ".merge_message:visible" ).val();
        return header + "\n\n" + body;
    };

    var do_merge = function( issue, type, author, callback ) {
        var params = {
            message: get_merge_message()
        };
        if ( author ) {
            params.author = $.trim( author );
        }
        var url = "/merge/" + type + "/" + issue;
        $.ajax({
            url: url,
            type: "POST",
            data: params,
            success: function( data ) {
                if ( $.isFunction( callback ) ) {
                    callback( data );
                }
            }
        });
    };

    var finish_merge = function( issue ) {
        back_to_pull_requests( function() {
            $( ".pull_request[data-issue='" + issue + "']" ).fadeOut( "fast" );
        });
    };

    var add_bindings = function() {

        $( ".pagination" ).on( "click", "li a", function( e ) {
            handle_pagination_click( $( this ) );
            e.preventDefault();
        });

        $( "#force_warning, #working" ).modal({
            backdrop: "static"
        });

        $( "#pull_request_focus" ).on( "hide", function() {
            current_issue = false;
        });

        $( ".modal ").on( "click", "button.closebtn", function( e ) {
            $( this ).parents( ".modal" ).modal( "hide" );
        });

        $( "div.content" ).on( "click", ".pull_request", function( e ) {
            show_pull_request( $( this ).attr( "data-issue" ), $( this ).attr( "data-github-url" ) );
        });

        $( "div.content" ).on( "click", "button#refresh_pulls", function( e ) {
            current_page = 0;
            refresh_pull_requests();
        });

        $( "div.sidebar" ).on( "click", "button#refresh", function( e ) {
            refresh_sidebar( false, true );
        });

        $( "div.sidebar" ).on( "click", "button.reset", function( e ) {
            if ( $( this ).attr( "data-harshness" ) ) {
                $( "#force_warning" ).modal( "show" );
            } else {
                do_reset( "master" );
            }
        });

        $( "#force_warning" ).on( "click", "button", function( e ) {
            if ( $( this ).attr( "data-action" ) === "continue" ) {
                do_reset( "master", true );
            } else {
                $( "#force_warning" ).modal( "hide" );
            }
        });

        $( "#pull_request_focus" ).on( "click", "button.back", back_to_pull_requests);

        $( "#pull_request_focus" ).on( "click", "button[data-action]", function( e ) {
            var action = $( this ).attr( "data-action" );
            toggle_buttons( false );
            switch (action) {
                case "reset":
                    var branch = $( this ).attr( "data-base" );
                    do_reset( branch, false, function() {
                        toggle_buttons( true );
                    });
                    break;
                case "validate":
                    working( true );
                    do_validate( current_issue, function() {
                        toggle_buttons( true );
                        working( false );
                    });
                    break;
                case "squash":
                    show_merge( "squash" );
                    break;
                case "merge":
                    show_merge( "merge" );
                    break;
                case "confirm":
                    working( true );
                    var author = false;
                    if ( merge_type === "squash" ) {
                        author = $( ".authors tr.selected" ).text();
                    }
                    do_merge( current_issue, merge_type, author, function() {
                        finish_merge( current_issue );
                        working( false );
                    });
                    break;
                case "cancel":
                    cancel_merge( function() {
                        toggle_buttons( true );
                    });
                    break;
                default:
                    break;
            }
        });

        $( "#pull_request_focus" ).on( "click", ".authors tr", function( e ) {
            if ( !$( this ).hasClass( "selected" ) ) {
                $( ".authors tr.selected" ).removeClass( "selected" );
                $( this ).addClass( "selected" );
            }
        });
    };

    var init = function() {
        add_bindings();
        refresh_pull_requests();
    };

    init();
});
